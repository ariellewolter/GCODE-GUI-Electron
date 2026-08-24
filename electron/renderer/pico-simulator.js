/* eslint-disable no-unused-vars */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PicoSimulator = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function picoSimulatorFactory() {
  const TREATMENT_Z_MAX_MM = 5.5;
  const WELL_REPOSITION_XY_MM = 15;

  function picoDisplayKind(ev) {
    if (ev.kind === "dwell") return "dwell";
    if (ev.rapid) return "travel";
    if (ev.eDelta > 0) return "dispense";
    if (!ev.xyChanged && ev.zChanged) return "zMove";
    if (!ev.xyChanged) return "dwell";
    return "travel";
  }

  function annotatePicoMotion(motion) {
    const events = (motion?.events || []).map((ev) => ({
      ...ev,
      displayKind: picoDisplayKind(ev),
    }));
    return {
      ...motion,
      events,
    };
  }

  function eventDuration(ev) {
    return Math.max(0, (ev.t1 || 0) - (ev.t0 || 0));
  }

  function inferRowSpacingMm(events) {
    const steps = [];
    events.forEach((ev) => {
      if (ev.displayKind !== "dispense") return;
      if (ev.from.y == null || ev.to.y == null) return;
      const dY = Math.abs(ev.to.y - ev.from.y);
      const dX = ev.from.x == null || ev.to.x == null ? 0 : Math.abs(ev.to.x - ev.from.x);
      if (dY >= 0.04 && dY <= 1.5 && dX < 0.5) steps.push(dY);
    });
    if (!steps.length) return null;
    steps.sort((a, b) => a - b);
    return steps[Math.floor(steps.length / 2)];
  }

  function dominantFeed(events, displayKind) {
    const tallies = new Map();
    events.forEach((ev) => {
      if (displayKind && ev.displayKind !== displayKind) return;
      if (!ev.feedMmPerMin) return;
      tallies.set(ev.feedMmPerMin, (tallies.get(ev.feedMmPerMin) || 0) + eventDuration(ev));
    });
    let best = null;
    let bestTime = -1;
    tallies.forEach((time, feed) => {
      if (time > bestTime) {
        best = feed;
        bestTime = time;
      }
    });
    return best;
  }

  function summarizePicoMotion(motion) {
    const events = motion?.events || [];
    let treatmentTimeSec = 0;
    let travelTimeSec = 0;
    let dwellTimeSec = 0;
    let zMoveTimeSec = 0;
    let treatmentPathLengthMm = 0;
    let travelPathLengthMm = 0;
    let zMoveLengthMm = 0;
    let treatmentSegmentCount = 0;
    let travelSegmentCount = 0;
    let zMoveCount = 0;
    let dwellCount = 0;

    events.forEach((ev) => {
      const dur = eventDuration(ev);
      const kind = ev.displayKind || picoDisplayKind(ev);
      if (kind === "dispense") {
        treatmentTimeSec += dur;
        treatmentPathLengthMm += ev.xyDistanceMm || 0;
        treatmentSegmentCount += 1;
      } else if (kind === "travel") {
        travelTimeSec += dur;
        travelPathLengthMm += ev.xyDistanceMm || 0;
        travelSegmentCount += 1;
      } else if (kind === "zMove") {
        zMoveTimeSec += dur;
        zMoveLengthMm += ev.zDistanceMm || 0;
        zMoveCount += 1;
      } else if (kind === "dwell") {
        dwellTimeSec += dur;
        dwellCount += 1;
      }
    });

    const feedRates = [...new Set(events.map((ev) => ev.feedMmPerMin).filter(Boolean))]
      .sort((a, b) => a - b);

    return {
      durationSec: motion?.durationSec || 0,
      treatmentTimeSec,
      travelTimeSec,
      dwellTimeSec,
      zMoveTimeSec,
      treatmentPathLengthMm,
      travelPathLengthMm,
      zMoveLengthMm,
      treatmentSegmentCount,
      travelSegmentCount,
      zMoveCount,
      dwellCount,
      minZ: motion?.bounds?.minZ ?? null,
      maxZ: motion?.bounds?.maxZ ?? null,
      feedRatesMmMin: feedRates,
      treatmentFeedMmMin: dominantFeed(events, "dispense"),
      inferredRowSpacingMm: inferRowSpacingMm(events),
    };
  }

  function parsePositiveNumber(value) {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function estimatePulseExposure(summary, pulserSettings = {}) {
    const rate = parsePositiveNumber(pulserSettings.repetitionRateHz);
    const rowSpacingMm = parsePositiveNumber(pulserSettings.rowSpacingMm)
      || summary.inferredRowSpacingMm;
    const entire = pulserSettings.activeDuring === "entireProgram";
    const mode = pulserSettings.mode || "continuous";
    const activeTimeSec = entire ? summary.durationSec : summary.treatmentTimeSec;
    const activePathMm = entire
      ? summary.treatmentPathLengthMm + summary.travelPathLengthMm
      : summary.treatmentPathLengthMm;
    const feed = summary.treatmentFeedMmMin;
    const speedMmPerSec = feed ? feed / 60 : null;

    if (!rate || mode !== "continuous") {
      return {
        rateHz: rate,
        mode,
        activeTimeSec,
        activePathMm,
        rowSpacingMm,
        speedMmPerSec,
        estimatedPulses: null,
        pulsesPerMm: null,
        pulsesPerMm2: null,
        note: !rate
          ? "Enter a pulse repetition rate to estimate exposure."
          : "Burst mode is recorded as metadata. Estimated exposure is shown for continuous operation only.",
      };
    }

    const estimatedPulses = rate * activeTimeSec;
    const pulsesPerMm = speedMmPerSec
      ? rate / speedMmPerSec
      : (activePathMm > 0 ? estimatedPulses / activePathMm : null);
    const pulsesPerMm2 = pulsesPerMm && rowSpacingMm
      ? pulsesPerMm / rowSpacingMm
      : null;

    return {
      rateHz: rate,
      mode,
      activeTimeSec,
      activePathMm,
      rowSpacingMm,
      speedMmPerSec,
      estimatedPulses,
      pulsesPerMm,
      pulsesPerMm2,
      note: null,
    };
  }

  function collectXy(events, treatmentOnly) {
    const pts = [];
    events.forEach((ev) => {
      if (ev.kind === "dwell") return;
      if (treatmentOnly && ev.displayKind !== "dispense") return;
      if (ev.from && ev.from.x != null && ev.from.y != null) {
        pts.push({ x: ev.from.x, y: ev.from.y, z: ev.from.z });
      }
      if (ev.to && ev.to.x != null && ev.to.y != null) {
        pts.push({ x: ev.to.x, y: ev.to.y, z: ev.to.z });
      }
    });
    return pts;
  }

  function xyBounds(pts) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    pts.forEach((p) => {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    });
    return { minX, minY, maxX, maxY };
  }

  function wellContains(plate, wellKey, x, y, extraMm) {
    const c = plate.wellCenters[wellKey];
    if (!c) return false;
    const r = (plate.wellRadiusMm || (plate.wellDiamMm || 0) / 2) + (extraMm || 0.5);
    return Math.hypot(x - c[0], y - c[1]) <= r;
  }

  function plateFallbackFocus(plate) {
    const centers = Object.values(plate.wellCenters || {});
    if (!centers.length) return null;
    const box = xyBounds(centers.map(([x, y]) => ({ x, y })));
    const pad = plate.wellRadiusMm || 8;
    const spanX = box.maxX - box.minX + pad * 2;
    const spanY = box.maxY - box.minY + pad * 2;
    return {
      wellKeys: [],
      center: { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2, z: 2 },
      radius: Math.max(spanX, spanY) * 0.9,
      spanX,
      spanY,
    };
  }

  function wellKeysForPoints(plate, pts) {
    if (!plate?.wellCenters || !pts.length) return [];
    const cx = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
    const cy = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;
    let bestKey = null;
    let bestD = Infinity;
    Object.entries(plate.wellCenters).forEach(([key, [wx, wy]]) => {
      const d = Math.hypot(cx - wx, cy - wy);
      if (d < bestD) {
        bestD = d;
        bestKey = key;
      }
    });
    if (bestKey && pts.every((p) => wellContains(plate, bestKey, p.x, p.y, 1.5))) {
      return [bestKey];
    }
    return Object.keys(plate.wellCenters).filter((key) => (
      pts.some((p) => wellContains(plate, key, p.x, p.y, 0.5))
    ));
  }

  function wellFocus(plate, wellKey) {
    const c = plate?.wellCenters?.[wellKey];
    if (!c) return null;
    const r = plate.wellRadiusMm || (plate.wellDiamMm || 14.5) / 2;
    const pad = 1.05;
    const span = r * 2 + pad * 2;
    return {
      wellKeys: [wellKey],
      center: { x: c[0], y: c[1], z: 0 },
      radius: span * 0.85,
      spanX: span,
      spanY: span,
    };
  }

  function wellAtXy(plate, x, y) {
    if (!plate?.wellCenters || x == null || y == null) return null;
    let bestKey = null;
    let bestD = Infinity;
    Object.entries(plate.wellCenters).forEach(([key, [wx, wy]]) => {
      const d = Math.hypot(x - wx, y - wy);
      if (d < bestD) {
        bestD = d;
        bestKey = key;
      }
    });
    if (!bestKey) return null;
    const r = plate.wellRadiusMm || (plate.wellDiamMm || 14.5) / 2;
    const pitch = Math.min(plate.pitchXmm || 99, plate.pitchYmm || 99);
    if (bestD <= r + 1.2 || bestD <= pitch * 0.55) return bestKey;
    return bestKey;
  }

  function lerp(a, b, u) {
    if (a == null || b == null) return b ?? a;
    return a + (b - a) * u;
  }

  function positionAtTime(motion, timeSec) {
    const events = (motion && motion.events) || [];
    const t = Math.max(0, Number(timeSec) || 0);
    let pos = null;
    for (let i = 0; i < events.length; i += 1) {
      const ev = events[i];
      if (ev.t0 > t) break;
      if (t >= ev.t1) {
        pos = ev.to;
      } else {
        const span = ev.t1 - ev.t0;
        const u = span > 1e-12 ? (t - ev.t0) / span : 1;
        pos = {
          x: lerp(ev.from?.x, ev.to?.x, u),
          y: lerp(ev.from?.y, ev.to?.y, u),
          z: lerp(ev.from?.z, ev.to?.z, u),
        };
      }
    }
    return pos;
  }

  /**
   * Tight well framing for the needle's current well (playback follow).
   */
  function liveFocusRegion(motion, plate, timeSec) {
    const pos = positionAtTime(motion, timeSec);
    const key = pos ? wellAtXy(plate, pos.x, pos.y) : null;
    if (key) return wellFocus(plate, key);
    return focusRegion(motion, plate);
  }
  function focusRegion(motion, plate) {
    const events = (motion && motion.events) || [];
    let pts = collectXy(events, true);
    if (pts.length < 2) pts = collectXy(events, false);
    if (!pts.length) return plate ? plateFallbackFocus(plate) : null;

    const box = xyBounds(pts);
    const wellKeys = wellKeysForPoints(plate, pts);

    if (plate && wellKeys.length === 1) {
      return wellFocus(plate, wellKeys[0]);
    }

    const pad = plate ? (plate.wellRadiusMm || 8) * 1.2 : 10;
    const spanX = Math.max(box.maxX - box.minX, 6) + pad * 2;
    const spanY = Math.max(box.maxY - box.minY, 6) + pad * 2;
    return {
      wellKeys,
      center: {
        x: (box.minX + box.maxX) / 2,
        y: (box.minY + box.maxY) / 2,
        z: 2,
      },
      radius: Math.max(spanX, spanY) * 1.15,
      spanX,
      spanY,
    };
  }

  function preflightMotion(motion, plate, hydrogelHeightMm, options = {}) {
    const events = motion?.events || [];
    const hydrogelTop = Math.max(0, Number(hydrogelHeightMm) || 0);
    const wellDepth = Math.max(0, Number(plate?.wellDepthMm) || 15);
    const clearance = Math.max(0, Number(options.travelClearanceMm) || 1);
    const injections = [];
    const warnings = [];
    let minimumBottomClearanceMm = Infinity;
    let maximumTravelZMm = -Infinity;

    events.forEach((event, eventIndex) => {
      const kind = event.displayKind || picoDisplayKind(event);
      const x = Number(event.to?.x);
      const y = Number(event.to?.y);
      const z = Number(event.to?.z);
      if (kind === "dispense" && event.eDelta > 0) {
        const wellKey = wellAtXy(plate, x, y);
        const center = wellKey ? plate?.wellCenters?.[wellKey] : null;
        const radius = Number(plate?.wellRadiusMm || plate?.wellDiamMm / 2 || 0);
        const distanceFromCenterMm = center ? Math.hypot(x - center[0], y - center[1]) : Infinity;
        const insideWell = Boolean(center && distanceFromCenterMm <= radius);
        const zStart = Number(event.from?.z);
        const zEnd = z;
        const zMin = Number.isFinite(zStart) && Number.isFinite(zEnd) ? Math.min(zStart, zEnd) : zEnd;
        const zMax = Number.isFinite(zStart) && Number.isFinite(zEnd) ? Math.max(zStart, zEnd) : zEnd;
        const zMid = Number.isFinite(zMin) && Number.isFinite(zMax) ? (zMin + zMax) / 2 : zEnd;
        const issues = [];
        if (!insideWell) issues.push("outside well boundary");
        if (!Number.isFinite(zMin) || !Number.isFinite(zMax)) issues.push("missing Z coordinate");
        else {
          minimumBottomClearanceMm = Math.min(minimumBottomClearanceMm, zMin);
          if (zMin < 0) issues.push(`${Math.abs(zMin).toFixed(2)} mm below well bottom`);
          if (zMax > hydrogelTop) issues.push(`${(zMax - hydrogelTop).toFixed(2)} mm above hydrogel`);
        }
        const injection = {
          index: injections.length + 1,
          eventIndex,
          timeSec: event.t1 || event.t0 || 0,
          wellKey: wellKey || "—",
          x, y, z: zMid, zStart, zEnd, zMin, zMax,
          eDelta: event.eDelta || 0,
          feedMmPerMin: event.feedMmPerMin || null,
          distanceFromCenterMm,
          insideWell,
          insideHydrogel: Number.isFinite(zMin) && Number.isFinite(zMax) && zMin >= 0 && zMax <= hydrogelTop,
          depthBelowSurfaceMm: Number.isFinite(zMid) ? hydrogelTop - zMid : null,
          issues,
        };
        injections.push(injection);
        issues.forEach((message) => warnings.push({ type: "injection", injectionIndex: injection.index, message }));
      }
      if (kind === "travel" && event.xyDistanceMm > 0) {
        if (Number.isFinite(z)) maximumTravelZMm = Math.max(maximumTravelZMm, z);
        const pitch = Math.min(Number(plate?.pitchXmm) || Infinity, Number(plate?.pitchYmm) || Infinity);
        const interWell = Number.isFinite(pitch) && event.xyDistanceMm >= pitch * 0.5;
        if (interWell && (!Number.isFinite(z) || z < wellDepth + clearance)) {
          warnings.push({ type: "travel", eventIndex, message: `inter-well travel below ${(wellDepth + clearance).toFixed(2)} mm clearance` });
        }
      }
    });

    return {
      injections,
      warnings,
      passed: injections.length > 0 && warnings.length === 0,
      minimumBottomClearanceMm: Number.isFinite(minimumBottomClearanceMm) ? minimumBottomClearanceMm : null,
      maximumTravelZMm: Number.isFinite(maximumTravelZMm) ? maximumTravelZMm : null,
      hydrogelTopMm: hydrogelTop,
      wellDepthMm: wellDepth,
    };
  }

  return {
    TREATMENT_Z_MAX_MM,
    WELL_REPOSITION_XY_MM,
    annotatePicoMotion,
    summarizePicoMotion,
    estimatePulseExposure,
    wellFocus,
    focusRegion,
    liveFocusRegion,
    preflightMotion,
  };
});
