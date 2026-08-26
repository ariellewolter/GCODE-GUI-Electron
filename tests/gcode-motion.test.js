const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  parseGcodeMotion,
  sampleTimeline,
  estimateGcodeRunTimeSec,
} = require("../electron/shared/gcode-motion.js");
const {
  annotatePicoMotion,
  summarizePicoMotion,
  focusRegion,
  liveFocusRegion,
  preflightMotion,
} = require("../electron/shared/pico-simulator.js");
const core = require("../electron/shared/gcode-core.js");

describe("gcode-motion parser", () => {
  it("tracks modal F across G1 lines without classifying pulses", () => {
    const gcode = ["G1 F30", "G1 X0 Y0 Z0", "G1 X1 Y0 Z0"].join("\n");
    const motion = parseGcodeMotion(gcode);
    assert.equal(motion.counts.linearMove, 2);
    assert.equal(motion.counts.dwell, 0);
    assert.ok(!motion.counts.pulse);
    assert.ok(Math.abs(motion.durationSec - 2) < 1e-6);
    assert.equal(estimateGcodeRunTimeSec(gcode), motion.durationSec);
    assert.equal(core.estimateGcodeRunTimeSec(gcode), motion.durationSec);
    motion.events.forEach((ev) => assert.equal(ev.kind, "linearMove"));
  });

  it("counts G4 P milliseconds and G4 S seconds", () => {
    const gcode = [
      "G1 X0 Y0 F350",
      "G4 P500",
      "G1 X10 Y0 F350",
      "G4 S120",
    ].join("\n");
    const seconds = estimateGcodeRunTimeSec(gcode);
    assert.ok(seconds > 120);
    assert.ok(seconds < 125);
  });

  it("records E deltas as motion facts, not electrical pulses", () => {
    const gcode = [
      "G1 X0 Y0 Z3 F350",
      "G1 Z3.01 E0.0105 F3",
    ].join("\n");
    const motion = parseGcodeMotion(gcode);
    assert.equal(motion.counts.linearMove, 2);
    const eMove = motion.events.find((ev) => ev.eDelta > 0);
    assert.ok(eMove);
    assert.equal(eMove.kind, "linearMove");
  });

  it("uses 3D hypot for combined XY+Z moves", () => {
    const gcode = ["G1 X0 Y0 Z0 F350", "G1 X10 Y0 Z3 F350"].join("\n");
    const expected = Math.hypot(10, 0, 3) / (350 / 60);
    assert.ok(Math.abs(estimateGcodeRunTimeSec(gcode) - expected) < 1e-6);
  });

  it("samples interpolated XYZ along a move", () => {
    const motion = parseGcodeMotion(["G1 X0 Y0 F60", "G1 X2 Y0 F60"].join("\n"));
    const mid = sampleTimeline(motion, 1);
    assert.ok(Math.abs(mid.x - 1) < 1e-6);
    assert.equal(mid.y, 0);
    assert.equal(mid.kind, "linearMove");
  });
});

describe("micropipette simulator overlay", () => {
  it("labels dispense, travel, Z moves, and dwell", () => {
    const gcode = [
      "G21",
      "G1 F30",
      "G1 X74.6 Y39.5 Z0.2",
      "G1 Z0.21 E0.0105 F3",
      "G1 X93.9 Y39.5 Z0.2",
      "G1 Z6.21 F350",
      "G4 P200",
    ].join("\n");
    const annotated = annotatePicoMotion(parseGcodeMotion(gcode));
    const kinds = annotated.events.map((ev) => ev.displayKind);
    assert.deepEqual(kinds, ["travel", "dispense", "travel", "zMove", "dwell"]);
  });

  it("adds a five-second visual transition and pass metadata for multi-print G-code", () => {
    const gcode = [
      "G1 X0 Y0 Z1 F60",
      "G1 Z1.01 E0.01 F3",
      "; === Print 2 (pass 2, same well A1) ===",
      "G1 Z1.02 E0.01 F3",
    ].join("\n");
    const motion = parseGcodeMotion(gcode);
    const transition = motion.events.find((event) => event.passTransition);
    const injections = motion.events.filter((event) => event.eDelta > 0);
    assert.ok(transition);
    assert.equal(transition.t1 - transition.t0, 5);
    assert.equal(transition.passNum, 2);
    assert.deepEqual(injections.map((event) => event.passNum), [1, 2]);
    const duringTransition = sampleTimeline(motion, transition.t0 + 1);
    assert.equal(duringTransition.passTransition, true);
    assert.equal(duringTransition.passNum, 2);
  });

  it("summarizes dispensing motion", () => {
    const gcode = [
      "G1 F30",
      "G1 X0 Y0 Z0.2",
      "G1 Z0.21 E0.0105 F3",
    ].join("\n");
    const summary = summarizePicoMotion(annotatePicoMotion(parseGcodeMotion(gcode)));
    assert.equal(summary.treatmentSegmentCount, 1);
    assert.equal(summary.treatmentPathLengthMm, 0);
    assert.ok(summary.treatmentTimeSec > 0);
    assert.equal(summary.treatmentFeedMmMin, 3);
  });

  it("focusRegion snaps A1 needle motion to the A1 well", () => {
    const plate = core.createPlateApi(core.DEFAULT_PLATE_TYPE);
    const [a1x, a1y] = plate.wellCenters.A1;
    const gcode = [
      "G1 F30",
      `G1 X${a1x - 1.35} Y${a1y - 1.5} Z0.2`,
      `G1 X${a1x + 1.4} Y${a1y - 1.5} Z0.2`,
      `G1 X${a1x + 1.4} Y${a1y + 1.5} Z0.2`,
    ].join("\n");
    const focus = focusRegion(annotatePicoMotion(parseGcodeMotion(gcode)), plate);
    assert.deepEqual(focus.wellKeys, ["A1"]);
    assert.ok(Math.abs(focus.center.x - plate.wellCenters.A1[0]) < 0.01);
    assert.ok(Math.abs(focus.center.y - plate.wellCenters.A1[1]) < 0.01);
    assert.ok(focus.radius < 18, "camera stays tight on one well, not the whole plate");
  });

  it("liveFocusRegion follows the needle into the next well", () => {
    const plate = core.createPlateApi(core.DEFAULT_PLATE_TYPE);
    const [a1x, a1y] = plate.wellCenters.A1;
    const [a2x, a2y] = plate.wellCenters.A2;
    const gcode = [
      "G1 F350",
      `G1 X${a1x} Y${a1y} Z0.2`,
      `G1 X${a1x + 1.4} Y${a1y} Z0.2`,
      "G1 Z8 F350",
      `G1 X${a2x} Y${a2y} Z8 F350`,
      "G1 Z0.2 F350",
      `G1 X${a2x + 1.4} Y${a2y} Z0.2 F30`,
    ].join("\n");
    const pico = annotatePicoMotion(parseGcodeMotion(gcode));
    const start = liveFocusRegion(pico, plate, 0.01);
    const end = liveFocusRegion(pico, plate, pico.durationSec);
    assert.deepEqual(start.wellKeys, ["A1"]);
    assert.deepEqual(end.wellKeys, ["A2"]);
  });

  it("preflight identifies injections above hydrogel and outside a well", () => {
    const plate = core.createPlateApi(core.DEFAULT_PLATE_TYPE);
    const [x, y] = plate.wellCenters.A1;
    const gcode = [
      `G1 X${x} Y${y} Z5 F30`,
      `G1 Z5.01 E0.01 F3`,
      `G1 X${x + plate.pitchXmm / 2} Y${y} Z1 F30`,
      `G1 Z1.01 E0.01 F3`,
    ].join("\n");
    const report = preflightMotion(annotatePicoMotion(parseGcodeMotion(gcode)), plate, 4.24);
    assert.equal(report.injections.length, 2);
    assert.ok(report.warnings.some((warning) => warning.message.includes("above hydrogel")));
    assert.ok(report.warnings.some((warning) => warning.message.includes("outside well boundary")));
    assert.equal(report.passed, false);
  });

  it("preflight passes an injection inside the well and hydrogel", () => {
    const plate = core.createPlateApi(core.DEFAULT_PLATE_TYPE);
    const [x, y] = plate.wellCenters.A1;
    const gcode = [`G1 X${x} Y${y} Z1 F30`, `G1 Z1.01 E0.01 F3`].join("\n");
    const report = preflightMotion(annotatePicoMotion(parseGcodeMotion(gcode)), plate, 4.24);
    assert.equal(report.injections.length, 1);
    assert.equal(report.injections[0].wellKey, "A1");
    assert.equal(report.passed, true);
  });

  it("preflight validates the entire Z extrusion segment", () => {
    const plate = core.createPlateApi(core.DEFAULT_PLATE_TYPE);
    const [x, y] = plate.wellCenters.A1;
    const gcode = [`G1 X${x} Y${y} Z-0.1 F30`, `G1 Z0.1 E0.01 F3`].join("\n");
    const report = preflightMotion(annotatePicoMotion(parseGcodeMotion(gcode)), plate, 4.24);
    assert.equal(report.injections[0].zStart, -0.1);
    assert.equal(report.injections[0].zEnd, 0.1);
    assert.equal(report.injections[0].z, 0);
    assert.ok(report.warnings.some((warning) => warning.message.includes("below well bottom")));
  });
});

describe("simulator 2D framing", () => {
  it("zooms job framing to the A1 well instead of the full plate", () => {
    require("../electron/renderer/simulator-2d.js");
    const plate = core.createPlateApi(core.DEFAULT_PLATE_TYPE);
    const [a1x, a1y] = plate.wellCenters.A1;
    const gcode = [
      "G1 F30",
      `G1 X${a1x - 1.35} Y${a1y - 1.5} Z0.2`,
      `G1 X${a1x + 1.4} Y${a1y - 1.5} Z0.2`,
      `G1 X${a1x + 1.4} Y${a1y + 1.5} Z0.2`,
    ].join("\n");
    const focus = focusRegion(annotatePicoMotion(parseGcodeMotion(gcode)), plate);
    const job = globalThis.GcodeSimulator2D.viewBounds(plate, focus, "job");
    const full = globalThis.GcodeSimulator2D.viewBounds(plate, focus, "plate");
    const [ax, ay] = plate.wellCenters.A1;
    assert.ok(job.minX < ax && job.maxX > ax);
    assert.ok(job.minY < ay && job.maxY > ay);
    assert.ok((job.maxX - job.minX) < 20, "job frame stays around one well");
    assert.ok((full.maxX - full.minX) > (job.maxX - job.minX) * 2);
  });
});

describe("Z elevation colors", () => {
  it("uses height-band hues and a raised color for high Z", () => {
    assert.equal(core.colorForZElevation(0.2), "#f97316");
    assert.equal(core.colorForZElevation(0.4), "#22c55e");
    assert.equal(core.colorForZElevation(8.2), core.Z_ELEVATION_RAISED_COLOR);
    assert.equal(core.colorForZSpan(0.2, 0.2, 8.2), core.Z_ELEVATION_COLOR_ANCHORS[0].color);
    assert.equal(core.colorForZSpan(8.2, 0.2, 8.2), core.Z_ELEVATION_COLOR_ANCHORS.at(-1).color);
    assert.notEqual(core.colorForZSpan(0.2, 0.2, 8.2), core.colorForZSpan(4.2, 0.2, 8.2));
    assert.notEqual(core.colorForZSpan(4.2, 0.2, 8.2), core.colorForZSpan(8.2, 0.2, 8.2));
  });
});
