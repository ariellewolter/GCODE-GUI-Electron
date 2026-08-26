/* eslint-disable no-unused-vars */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.GcodeMotion = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function gcodeMotionFactory() {
  const WORD_RE = /([A-Za-z])\s*([-+]?\d*\.?\d+)/g;
  const E_EPS = 1e-9;
  const MULTI_PASS_TRANSITION_SEC = 5;

  function stripInlineComment(line) {
    const idx = line.indexOf(";");
    if (idx === -1) return line;
    return line.slice(0, idx);
  }

  function parseWords(line) {
    const words = {};
    WORD_RE.lastIndex = 0;
    let match;
    while ((match = WORD_RE.exec(line))) {
      words[match[1].toUpperCase()] = Number(match[2]);
    }
    return words;
  }

  function moveDistance({ xyChanged, zChanged, dx, dy, dz, hasPrevXY, hasPrevZ }) {
    if (xyChanged && zChanged && hasPrevXY && hasPrevZ) {
      return Math.hypot(dx, dy, dz);
    }
    if (xyChanged && hasPrevXY) return Math.hypot(dx, dy);
    if (zChanged && hasPrevZ) return Math.abs(dz);
    return 0;
  }

  function parseGcodeMotion(gcodeText) {
    const events = [];
    let t = 0;
    let x = null;
    let y = null;
    let z = null;
    let e = 0;
    let f = null;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    const counts = { linearMove: 0, dwell: 0 };
    const feedRates = new Set();
    let currentPass = 1;

    function touchBounds(px, py, pz) {
      if (px != null && Number.isFinite(px)) {
        minX = Math.min(minX, px);
        maxX = Math.max(maxX, px);
      }
      if (py != null && Number.isFinite(py)) {
        minY = Math.min(minY, py);
        maxY = Math.max(maxY, py);
      }
      if (pz != null && Number.isFinite(pz)) {
        minZ = Math.min(minZ, pz);
        maxZ = Math.max(maxZ, pz);
      }
    }

    function pushEvent(event) {
      events.push(event);
      counts[event.kind] = (counts[event.kind] || 0) + 1;
      t = event.t1;
      touchBounds(event.to.x, event.to.y, event.to.z);
      if (event.feedMmPerMin) feedRates.add(event.feedMmPerMin);
    }

    String(gcodeText || "").split(/\r?\n/).forEach((rawLine, lineIndex) => {
      const passHeader = rawLine.match(/^\s*;\s*===\s*Print\s+(\d+)\b/i);
      if (passHeader) {
        const nextPass = Math.max(1, Number(passHeader[1]) || 1);
        if (nextPass !== currentPass && events.length) {
          pushEvent({
            t0: t,
            t1: t + MULTI_PASS_TRANSITION_SEC,
            from: { x, y, z },
            to: { x, y, z },
            kind: "dwell",
            rapid: false,
            feedMmPerMin: f,
            xyChanged: false,
            zChanged: false,
            xyDistanceMm: 0,
            zDistanceMm: 0,
            distanceMm: 0,
            eDelta: 0,
            lineIndex,
            passNum: nextPass,
            passTransition: true,
          });
        }
        currentPass = nextPass;
        return;
      }
      const trimmed = stripInlineComment(rawLine).trim();
      if (!trimmed) return;

      const words = parseWords(trimmed);
      if (words.F != null && Number.isFinite(words.F) && words.F > 0) {
        f = words.F;
      }

      if (words.G === 4) {
        let dwellSec = 0;
        if (words.S != null && Number.isFinite(words.S)) dwellSec = words.S;
        else if (words.P != null && Number.isFinite(words.P)) dwellSec = words.P / 1000;
        pushEvent({
          t0: t,
          t1: t + Math.max(0, dwellSec),
          from: { x, y, z },
          to: { x, y, z },
          kind: "dwell",
          rapid: false,
          feedMmPerMin: f,
          xyChanged: false,
          zChanged: false,
          xyDistanceMm: 0,
          zDistanceMm: 0,
          distanceMm: 0,
          eDelta: 0,
          lineIndex,
          passNum: currentPass,
        });
        return;
      }

      const isG0 = words.G === 0;
      const isG1 = words.G === 1;
      if (!isG0 && !isG1) return;

      const nextX = words.X != null && Number.isFinite(words.X) ? words.X : x;
      const nextY = words.Y != null && Number.isFinite(words.Y) ? words.Y : y;
      const nextZ = words.Z != null && Number.isFinite(words.Z) ? words.Z : z;
      const nextE = words.E != null && Number.isFinite(words.E) ? e + words.E : e;
      const eDelta = nextE - e;

      const xyChanged = (nextX !== x || nextY !== y) && (nextX != null && nextY != null);
      const zChanged = nextZ !== z && nextZ != null;
      if (!xyChanged && !zChanged && eDelta <= E_EPS) return;

      const hasPrevXY = x != null && y != null;
      const hasPrevZ = z != null;
      const xyDistanceMm = hasPrevXY && nextX != null && nextY != null
        ? Math.hypot(nextX - x, nextY - y)
        : 0;
      const zDistanceMm = hasPrevZ && nextZ != null ? Math.abs(nextZ - z) : 0;
      const distanceMm = moveDistance({
        xyChanged,
        zChanged,
        dx: hasPrevXY ? (nextX ?? 0) - x : 0,
        dy: hasPrevXY ? (nextY ?? 0) - y : 0,
        dz: hasPrevZ ? (nextZ ?? 0) - z : 0,
        hasPrevXY,
        hasPrevZ,
      });
      const feed = f && f > 0 ? f : 0;
      const durationSec = feed > 0 ? distanceMm / (feed / 60) : 0;

      pushEvent({
        t0: t,
        t1: t + durationSec,
        from: { x, y, z },
        to: { x: nextX, y: nextY, z: nextZ },
        kind: "linearMove",
        rapid: isG0,
        feedMmPerMin: f,
        xyChanged,
        zChanged,
        xyDistanceMm,
        zDistanceMm,
        distanceMm,
        eDelta,
        lineIndex,
        passNum: currentPass,
      });

      x = nextX;
      y = nextY;
      z = nextZ;
      e = nextE;
    });

    const bounds = {
      minX: Number.isFinite(minX) ? minX : 0,
      maxX: Number.isFinite(maxX) ? maxX : 0,
      minY: Number.isFinite(minY) ? minY : 0,
      maxY: Number.isFinite(maxY) ? maxY : 0,
      minZ: Number.isFinite(minZ) ? minZ : 0,
      maxZ: Number.isFinite(maxZ) ? maxZ : 0,
    };

    return {
      events,
      durationSec: t,
      bounds,
      counts,
      feedRatesMmMin: [...feedRates].sort((a, b) => a - b),
    };
  }

  function lerp(a, b, u) {
    if (a == null || b == null) return b ?? a;
    return a + (b - a) * u;
  }

  function sampleTimeline(motion, timeSec) {
    const events = motion?.events || [];
    const durationSec = motion?.durationSec || 0;
    const t = Math.max(0, Math.min(durationSec, Number(timeSec) || 0));
    let x = null;
    let y = null;
    let z = null;
    let f = null;
    let kind = null;
    let displayKind = null;
    let eventIndex = -1;

    for (let i = 0; i < events.length; i += 1) {
      const ev = events[i];
      if (t < ev.t0) break;
      eventIndex = i;
      kind = ev.kind;
      displayKind = ev.displayKind || ev.kind;
      f = ev.feedMmPerMin;
      const span = ev.t1 - ev.t0;
      const u = span > 1e-12 ? Math.min(1, Math.max(0, (t - ev.t0) / span)) : 1;
      if (ev.kind === "dwell" || t >= ev.t1) {
        x = ev.to.x;
        y = ev.to.y;
        z = ev.to.z;
      } else {
        x = lerp(ev.from.x, ev.to.x, u);
        y = lerp(ev.from.y, ev.to.y, u);
        z = lerp(ev.from.z, ev.to.z, u);
      }
    }

    return {
      t,
      durationSec,
      x,
      y,
      z,
      f,
      kind,
      displayKind,
      eventIndex,
      passNum: events[eventIndex]?.passNum || 1,
      passTransition: Boolean(events[eventIndex]?.passTransition),
    };
  }

  function trailPoints(motion, timeSec, maxPoints = 800) {
    const events = motion?.events || [];
    const t = Math.max(0, Number(timeSec) || 0);
    const points = [];
    for (let i = 0; i < events.length; i += 1) {
      const ev = events[i];
      if (ev.t0 > t) break;
      const displayKind = ev.displayKind || ev.kind;
      if (ev.from.x != null && ev.from.y != null && points.length === 0) {
        points.push({
          x: ev.from.x,
          y: ev.from.y,
          z: ev.from.z,
          kind: displayKind,
          displayKind,
        });
      }
      if (t >= ev.t1) {
        if (ev.to.x != null && ev.to.y != null) {
          points.push({
            x: ev.to.x,
            y: ev.to.y,
            z: ev.to.z,
            kind: displayKind,
            displayKind,
          });
        }
      } else {
        const span = ev.t1 - ev.t0;
        const u = span > 1e-12 ? Math.min(1, (t - ev.t0) / span) : 1;
        const pt = {
          x: lerp(ev.from.x, ev.to.x, u),
          y: lerp(ev.from.y, ev.to.y, u),
          z: lerp(ev.from.z, ev.to.z, u),
          kind: displayKind,
          displayKind,
        };
        if (pt.x != null && pt.y != null) points.push(pt);
      }
    }
    if (points.length <= maxPoints) return points;
    const step = (points.length - 1) / (maxPoints - 1);
    const sampled = [];
    for (let i = 0; i < maxPoints; i += 1) {
      sampled.push(points[Math.round(i * step)]);
    }
    return sampled;
  }

  function estimateGcodeRunTimeSec(gcodeText) {
    return parseGcodeMotion(gcodeText).durationSec;
  }

  return {
    parseGcodeMotion,
    MULTI_PASS_TRANSITION_SEC,
    sampleTimeline,
    trailPoints,
    estimateGcodeRunTimeSec,
  };
});
