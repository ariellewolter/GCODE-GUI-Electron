const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const core = require("../electron/shared/gcode-core.js");

const {
  DEFAULT_24WELL_STARTS,
  DEFAULT_24WELL_CENTERS,
  MAX_GRID_DOTS,
  WELL_DIAM_MM,
  safeInt,
  safeFloat,
  parseEcalcFloat,
  computeGridDotsFromParams,
  computeGridLayout,
  validatePassSettingsFromValues,
  validatePassSettings,
  validatePrintParams,
  validateAngleOffsetValues,
  validateCircleParams,
  validateDotsInsideWell,
  passSettingsMatch,
  applyPrint2PassSettings,
  applyProgressiveYOffset,
  buildCombinedGcode,
  translateStartForWell,
  isDotInsideWellMm,
  computeCircleDots,
  resolveParamsDots,
  parsePatternFloat,
} = core;

function mockPassFields(lower, upper, extrusion) {
  return {
    lowerZ: { value: lower },
    upperZ: { value: upper },
    extrusionE: { value: extrusion },
  };
}

function defaultGridParams(overrides = {}) {
  return {
    well: "A1",
    wellNumber: "A1",
    startX: DEFAULT_24WELL_STARTS.A1[0],
    startY: DEFAULT_24WELL_STARTS.A1[1],
    numDots: 30,
    perRow: 10,
    spacingX: 0.3,
    spacingY: 1.5,
    lowerZ: 1.5,
    upperZ: 1.51,
    extrusionE: 0.0105,
    ...overrides,
  };
}

describe("parseEcalcFloat", () => {
  it("returns null for empty input", () => {
    assert.equal(parseEcalcFloat(""), null);
    assert.equal(parseEcalcFloat("   "), null);
  });

  it("parses valid numbers", () => {
    assert.equal(parseEcalcFloat("1.5"), 1.5);
    assert.equal(parseEcalcFloat("0"), 0);
  });
});

describe("computeGridLayout", () => {
  it("returns zero dots when rows or perRow is non-positive", () => {
    assert.deepEqual(computeGridLayout(0, 10), { rows: 0, perRow: 10, dots: 0 });
    assert.deepEqual(computeGridLayout(3, 0), { rows: 3, perRow: 0, dots: 0 });
    assert.deepEqual(computeGridLayout(-2, 10), { rows: -2, perRow: 10, dots: 0 });
  });

  it("clamps oversized grids to MAX_GRID_DOTS", () => {
    const layout = computeGridLayout(999, 999);
    assert.equal(layout.dots, MAX_GRID_DOTS);
    assert.ok(layout.rows <= 999);
    assert.ok(layout.perRow <= 999);
  });
});

describe("validatePassSettings", () => {
  it("rejects empty Z and E fields", () => {
    assert.match(
      validatePassSettings(mockPassFields("", "1.51", "0.0105")),
      /required/i
    );
  });

  it("accepts valid pass settings", () => {
    assert.equal(
      validatePassSettings(mockPassFields("1.5", "1.51", "0.0105")),
      null
    );
  });
});

describe("validatePrintParams", () => {
  it("accepts default A1 grid", () => {
    assert.equal(validatePrintParams(defaultGridParams()), null);
  });

  it("rejects too many dots", () => {
    const err = validatePrintParams(defaultGridParams({ numDots: MAX_GRID_DOTS + 1 }));
    assert.match(err, /Too many dots/);
  });

  it("rejects dots outside well", () => {
    const err = validatePrintParams(defaultGridParams({
      startX: DEFAULT_24WELL_CENTERS.A1[0],
      startY: DEFAULT_24WELL_CENTERS.A1[1],
      spacingX: 2,
      spacingY: 2,
      numDots: 30,
      perRow: 10,
    }));
    assert.match(err, /outside well/);
  });
});

describe("validateAngleOffsetValues", () => {
  it("requires min and max when offset enabled", () => {
    assert.match(validateAngleOffsetValues(null, 1), /required/i);
  });

  it("rejects min greater than max", () => {
    assert.match(validateAngleOffsetValues(2, 1), /Min Y offset/);
  });
});

describe("validateCircleParams", () => {
  it("accepts default circle in A1", () => {
    const [cx, cy] = DEFAULT_24WELL_CENTERS.A1;
    const params = {
      well: "A1",
      wellNumber: "A1",
      centerX: cx,
      centerY: cy,
      numDots: 12,
      radiusMm: 3,
      lowerZ: 1.5,
      upperZ: 1.51,
      extrusionE: 0.0105,
      customDots: computeCircleDots(cx, cy, 3, 12),
    };
    assert.equal(validateCircleParams(params), null);
  });

  it("rejects radius larger than well", () => {
    const params = {
      wellNumber: "A1",
      well: "A1",
      numDots: 8,
      radiusMm: WELL_DIAM_MM,
      lowerZ: 1.5,
      upperZ: 1.51,
      extrusionE: 0.0105,
      customDots: [],
    };
    assert.match(validateCircleParams(params), /Radius exceeds/);
  });
});

describe("passSettingsMatch and applyPrint2PassSettings", () => {
  it("detects matching pass settings", () => {
    const a = { lowerZ: 1.5, upperZ: 1.51, extrusionE: 0.0105 };
    const b = { lowerZ: 1.5, upperZ: 1.51, extrusionE: 0.0105 };
    assert.equal(passSettingsMatch(a, b), true);
  });

  it("applies print 2 pass values independently", () => {
    const merged = applyPrint2PassSettings(defaultGridParams(), {
      lowerZ: "2.0",
      upperZ: "2.1",
      extrusionE: "0.02",
    });
    assert.equal(merged.lowerZ, 2);
    assert.equal(merged.upperZ, 2.1);
    assert.equal(merged.extrusionE, 0.02);
    assert.equal(merged.wellNumber, "A1");
  });
});

describe("buildCombinedGcode", () => {
  const stubGcode = (params) => `GCODE:${params.wellNumber}:Z${params.lowerZ}`;

  it("repeats pass 1 gcode when pattern and pass settings match", () => {
    const print1 = defaultGridParams();
    const print2 = { ...print1 };
    const combined = buildCombinedGcode(print1, print2, true, stubGcode);
    assert.match(combined, /same pattern as Print 1/);
    assert.equal(combined.split("GCODE:A1:Z1.5").length - 1, 2);
  });

  it("generates separate pass 2 gcode when Z differs", () => {
    const print1 = defaultGridParams();
    const print2 = applyPrint2PassSettings(defaultGridParams(), {
      lowerZ: "2",
      upperZ: "2.1",
      extrusionE: "0.0105",
    });
    const combined = buildCombinedGcode(print1, print2, true, stubGcode);
    assert.doesNotMatch(combined, /same pattern as Print 1/);
    assert.match(combined, /GCODE:A1:Z1.5/);
    assert.match(combined, /GCODE:A1:Z2/);
  });

  it("generates separate pass 2 gcode when Y-offset custom dots are used", () => {
    const print1 = defaultGridParams();
    const print2 = {
      ...print1,
      customDots: [{ absX: 1, absY: 2 }],
    };
    const combined = buildCombinedGcode(print1, print2, true, stubGcode);
    assert.doesNotMatch(combined, /same pattern as Print 1/);
  });
});

describe("translateStartForWell", () => {
  it("preserves offset from default start across wells", () => {
    const refStart = DEFAULT_24WELL_STARTS.A1;
    const [bx, by] = translateStartForWell("A1", "B3", refStart[0] + 0.5, refStart[1] - 0.2);
    const bDefault = DEFAULT_24WELL_STARTS.B3;
    assert.ok(Math.abs(bx - (bDefault[0] + 0.5)) < 0.001);
    assert.ok(Math.abs(by - (bDefault[1] - 0.2)) < 0.001);
  });
});

describe("applyProgressiveYOffset", () => {
  it("keeps X aligned with print 1 and ramps Y across row", () => {
    const print1Dots = computeGridDotsFromParams(defaultGridParams({ numDots: 20, perRow: 10 }));
    const base = print1Dots.map((d) => ({ ...d }));
    const offsetDots = applyProgressiveYOffset(base, print1Dots, 10, 0.1, 1.0, 1);
    assert.equal(offsetDots[0].absX, print1Dots[0].absX);
    assert.ok(offsetDots[9].absY > offsetDots[0].absY);
  });
});

describe("bulk well geometry", () => {
  it("keeps default grid inside each translated well", () => {
    for (const wellKey of ["A1", "B3", "D6"]) {
      const [sx, sy] = translateStartForWell("A1", wellKey, DEFAULT_24WELL_STARTS.A1[0], DEFAULT_24WELL_STARTS.A1[1]);
      const params = defaultGridParams({ well: wellKey, wellNumber: wellKey, startX: sx, startY: sy });
      assert.equal(validateDotsInsideWell(params, wellKey), null);
    }
  });

  it("detects outside dots per well", () => {
    const [cx, cy] = DEFAULT_24WELL_CENTERS.A1;
    assert.equal(isDotInsideWellMm(cx, cy, "A1"), true);
    assert.equal(isDotInsideWellMm(cx + WELL_DIAM_MM, cy, "A1"), false);
  });
});

describe("formatCoordMm, formatZMm, formatExtrusionE", () => {
  const {
    formatCoordMm,
    formatZMm,
    formatExtrusionE,
    formatGcodeXY,
    COORD_MM_DECIMALS,
    EXTRUSION_E_DECIMALS,
  } = core;

  it("uses 2 decimals for mm coordinates and Z", () => {
    assert.equal(COORD_MM_DECIMALS, 2);
    assert.equal(formatCoordMm(37.554), "37.55");
    assert.equal(formatCoordMm(37.556), "37.56");
    assert.equal(formatZMm(1.5), "1.50");
  });

  it("uses 4 decimals for extrusion E", () => {
    assert.equal(EXTRUSION_E_DECIMALS, 4);
    assert.equal(formatExtrusionE(0.0105), "0.0105");
    assert.equal(formatExtrusionE(0.1), "0.1000");
  });

  it("formats G-code XY pairs consistently", () => {
    assert.equal(formatGcodeXY(37.55, 46.3), "X37.55 Y46.30");
  });
});

describe("safeInt and safeFloat", () => {
  it("returns 0 for invalid numeric input", () => {
    assert.equal(safeInt("abc"), 0);
    assert.equal(safeFloat(""), 0);
  });
});

describe("parsePatternFloat", () => {
  it("returns 0 for empty pattern fields", () => {
    assert.equal(parsePatternFloat(""), 0);
    assert.equal(parsePatternFloat("  "), 0);
  });

  it("parses the same values as parseEcalcFloat for non-empty input", () => {
    assert.equal(parsePatternFloat("37.55"), 37.55);
    assert.equal(parsePatternFloat("  2.5 "), 2.5);
  });
});

describe("resolveParamsDots (preview and export share this path)", () => {
  it("matches computeGridDotsFromParams for standard grids", () => {
    const params = defaultGridParams({ numDots: 6, perRow: 3 });
    assert.deepEqual(resolveParamsDots(params), computeGridDotsFromParams(params));
  });

  it("uses customDots when provided", () => {
    const customDots = [
      { absX: 38.5, absY: 47.2 },
      { absX: 39.0, absY: 47.8 },
    ];
    const params = defaultGridParams({ customDots });
    assert.deepEqual(resolveParamsDots(params), customDots);
  });

  it("matches circle dot layout used in circle export", () => {
    const [cx, cy] = DEFAULT_24WELL_CENTERS.A1;
    const customDots = computeCircleDots(cx, cy, 3, 8, 45);
    const params = defaultGridParams({ customDots, numDots: 8 });
    assert.deepEqual(resolveParamsDots(params), customDots);
  });

  it("matches bulk translated grid dots", () => {
    const [sx, sy] = translateStartForWell(
      "A1",
      "C4",
      DEFAULT_24WELL_STARTS.A1[0],
      DEFAULT_24WELL_STARTS.A1[1]
    );
    const params = defaultGridParams({
      well: "C4",
      wellNumber: "C4",
      startX: sx,
      startY: sy,
    });
    assert.deepEqual(resolveParamsDots(params), computeGridDotsFromParams(params));
  });

  it("matches Y-offset pass 2 dots", () => {
    const print1 = defaultGridParams({ numDots: 10, perRow: 5 });
    const print1Dots = computeGridDotsFromParams(print1);
    const customDots = applyProgressiveYOffset(
      print1Dots.map((dot) => ({ ...dot })),
      print1Dots,
      5,
      0.1,
      1.0,
      1
    );
    const print2 = { ...print1, customDots };
    assert.deepEqual(resolveParamsDots(print2), customDots);
  });
});
