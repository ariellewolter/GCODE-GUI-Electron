(function (root) {
  const WELL_FLOOR_Z = 0;
  const WELL_RIM_Z = 2.35;
  const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

  function plateBounds(plate) {
    const centers = Object.values(plate.wellCenters || {});
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    centers.forEach(([x, y]) => {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    });
    const pad = (plate.wellDiamMm || 14.5) / 2 + 4;
    if (!Number.isFinite(minX)) {
      return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
    }
    return { minX: minX - pad, maxX: maxX + pad, minY: minY - pad, maxY: maxY + pad };
  }

  function viewBounds(plate, focus, fitMode) {
    if (fitMode !== "plate" && focus && Number.isFinite(focus.center?.x) && Number.isFinite(focus.center?.y)) {
      if (focus.treatmentFocus) {
        const half = Math.max(2, Math.max(focus.spanX || 4, focus.spanY || 4) / 2);
        return {
          minX: focus.center.x - half,
          maxX: focus.center.x + half,
          minY: focus.center.y - half,
          maxY: focus.center.y + half,
        };
      }
      const pad = focus.wellKeys?.length === 1 ? 0.25 : 2.2;
      const hx = Math.max((focus.spanX || 14) / 2, 6) + pad;
      const hy = Math.max((focus.spanY || 14) / 2, 6) + pad;
      return {
        minX: focus.center.x - hx,
        maxX: focus.center.x + hx,
        minY: focus.center.y - hy,
        maxY: focus.center.y + hy,
      };
    }
    return plateBounds(plate);
  }

  function mmToPx(x, y, bounds, cw, ch, margin) {
    const spanX = Math.max(bounds.maxX - bounds.minX, 1);
    const spanY = Math.max(bounds.maxY - bounds.minY, 1);
    const scale = Math.min((cw - 2 * margin) / spanX, (ch - 2 * margin) / spanY);
    const ox = (cw - spanX * scale) / 2;
    const oy = (ch - spanY * scale) / 2;
    return {
      px: ox + (x - bounds.minX) * scale,
      py: ch - oy - (y - bounds.minY) * scale,
      scale,
    };
  }

  function sizeCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = Math.max(1, Math.round(rect.width || canvas.width || 1));
    const cssH = Math.max(1, Math.round(rect.height || canvas.height || 1));
    const nextW = Math.max(1, Math.round(cssW * dpr));
    const nextH = Math.max(1, Math.round(cssH * dpr));
    if (canvas.width !== nextW) canvas.width = nextW;
    if (canvas.height !== nextH) canvas.height = nextH;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, cw: cssW, ch: cssH };
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }

  function drawWell(ctx, p, r, key, active, hydrogelHeightMm = 0) {
    if (r < 2) return;
    ctx.beginPath();
    ctx.arc(p.px, p.py + Math.max(1.2, r * 0.04), r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(15, 23, 42, 0.08)";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(p.px, p.py, r, 0, Math.PI * 2);
    ctx.fillStyle = active && hydrogelHeightMm > 0 ? "rgba(244, 114, 182, 0.34)" : active ? "#fff7ed" : "#ffffff";
    ctx.fill();
    ctx.strokeStyle = active ? "#dc2626" : "#94a3b8";
    ctx.lineWidth = active ? Math.max(2.2, r * 0.045) : Math.max(1.2, r * 0.03);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(p.px, p.py, Math.max(r - Math.max(3, r * 0.08), r * 0.88), 0, Math.PI * 2);
    ctx.strokeStyle = active ? "rgba(220, 38, 38, 0.28)" : "rgba(148, 163, 184, 0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();

    const fontPx = Math.max(11, Math.min(18, r * 0.28));
    ctx.fillStyle = active ? "#9f1239" : "#64748b";
    ctx.font = `600 ${fontPx}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (r > 28) ctx.fillText(key, p.px, p.py - r - fontPx * 0.85);
    else ctx.fillText(key, p.px, p.py);
  }

  const Z_PATH_ANCHORS = ["#dc2626", "#f97316", "#facc15", "#22c55e", "#3b82f6", "#9333ea"];

  function lerpHex(colorA, colorB, t) {
    const blend = Math.max(0, Math.min(1, t));
    const parse = (hex) => {
      const m = String(hex).match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
      if (!m) return [0, 0, 0];
      return [Number.parseInt(m[1], 16), Number.parseInt(m[2], 16), Number.parseInt(m[3], 16)];
    };
    const [r1, g1, b1] = parse(colorA);
    const [r2, g2, b2] = parse(colorB);
    const ch = (a, b) => Math.round(a + (b - a) * blend).toString(16).padStart(2, "0");
    return `#${ch(r1, r2)}${ch(g1, g2)}${ch(b1, b2)}`;
  }

  function colorAlongRainbow(t) {
    const u = Math.max(0, Math.min(1, t));
    const scaled = u * (Z_PATH_ANCHORS.length - 1);
    const i = Math.min(Z_PATH_ANCHORS.length - 2, Math.floor(scaled));
    return lerpHex(Z_PATH_ANCHORS[i], Z_PATH_ANCHORS[i + 1], scaled - i);
  }

  function zColor(z, zBounds) {
    if (root.GcodeCore?.colorForZSpan) {
      return root.GcodeCore.colorForZSpan(z, zBounds?.minZ, zBounds?.maxZ);
    }
    if (!Number.isFinite(z)) return Z_PATH_ANCHORS[0];
    const lo = Number.isFinite(zBounds?.minZ) ? zBounds.minZ : 0;
    const hi = Number.isFinite(zBounds?.maxZ) ? zBounds.maxZ : 8;
    const span = hi - lo;
    if (!(span > 0.02)) return colorAlongRainbow(Math.max(0, Math.min(1, z / 0.6)));
    return colorAlongRainbow((z - lo) / span);
  }

  function drawTrail(ctx, trail, map, zBounds, options = {}) {
    if (!trail || trail.length < 2) return;
    const probe = map(trail[0].x || 0, trail[0].y || 0);
    const pitchPx = 0.1 * probe.scale;
    const treatW = Math.min(1.0, Math.max(0.5, pitchPx * 0.38));
    const travelW = Math.min(0.8, Math.max(0.45, pitchPx * 0.28));
    ctx.lineJoin = "round";
    for (let i = 1; i < trail.length; i += 1) {
      const prev = trail[i - 1];
      const cur = trail[i];
      const kind = cur.displayKind || cur.kind;
      if (kind === "dwell" || prev.x == null || cur.x == null) continue;
      if (kind === "travel" && options.showTravelMoves === false) continue;
      if (kind === "zMove" && options.showZMoves === false) continue;
      const p0 = map(prev.x, prev.y);
      const p1 = map(cur.x, cur.y);
      if (Math.hypot(p1.px - p0.px, p1.py - p0.py) < 0.2) continue;
      const z0 = prev.z ?? cur.z;
      const z1 = cur.z ?? prev.z;
      const treating = kind === "dispense";
      ctx.lineCap = treating ? "butt" : "round";
      ctx.setLineDash(kind === "travel" ? [4, 4] : kind === "zMove" ? [2, 3] : []);
      const c0 = zColor(z0, zBounds);
      const c1 = zColor(z1, zBounds);
      if (c0 === c1) {
        ctx.strokeStyle = c0;
      } else {
        const gradient = ctx.createLinearGradient(p0.px, p0.py, p1.px, p1.py);
        gradient.addColorStop(0, c0);
        gradient.addColorStop(1, c1);
        ctx.strokeStyle = gradient;
      }
      ctx.globalAlpha = treating ? 0.95 : 0.8;
      ctx.lineWidth = treating ? treatW : travelW;
      ctx.beginPath();
      ctx.moveTo(p0.px, p0.py);
      ctx.lineTo(p1.px, p1.py);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.lineCap = "round";
  }

  function drawHead(ctx, p, treating, z, scale, zBounds) {
    const color = Number.isFinite(z) ? zColor(z, zBounds) : (treating ? "#dc2626" : "#0f172a");
    const r = Math.max(4, Math.min(6.5, (scale || 20) * 0.18));
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.px, p.py, r, 0, Math.PI * 2);
    ctx.fillStyle = treating ? "rgba(220, 38, 38, 0.14)" : "rgba(15, 23, 42, 0.1)";
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(p.px, p.py, Math.max(1.6, r * 0.28), 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    const tick = r + 4;
    const gap = r + 1;
    ctx.beginPath();
    ctx.moveTo(p.px - tick, p.py);
    ctx.lineTo(p.px - gap, p.py);
    ctx.moveTo(p.px + gap, p.py);
    ctx.lineTo(p.px + tick, p.py);
    ctx.moveTo(p.px, p.py - tick);
    ctx.lineTo(p.px, p.py - gap);
    ctx.moveTo(p.px, p.py + gap);
    ctx.lineTo(p.px, p.py + tick);
    ctx.stroke();
    ctx.restore();
  }

  function niceScaleMm(spanMm) {
    const candidates = [0.5, 1, 2, 5, 10, 20];
    const target = spanMm / 5;
    return candidates.reduce((best, n) => (
      Math.abs(n - target) < Math.abs(best - target) ? n : best
    ), candidates[0]);
  }

  function drawScaleBar(ctx, map, bounds, cw, ch) {
    const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
    const mm = niceScaleMm(span);
    const p0 = map(bounds.minX, bounds.minY);
    const len = mm * p0.scale;
    const x = 16;
    const y = ch - 18;
    ctx.save();
    ctx.strokeStyle = "#334155";
    ctx.fillStyle = "#334155";
    ctx.lineWidth = 1.6;
    ctx.lineCap = "butt";
    ctx.beginPath();
    ctx.moveTo(x, y - 5);
    ctx.lineTo(x, y);
    ctx.lineTo(x + len, y);
    ctx.lineTo(x + len, y - 5);
    ctx.stroke();
    ctx.font = `12px ${FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(`${mm} mm`, x + len + 8, y + 2);
    ctx.restore();
  }

  function drawHud(ctx, focus, fitMode) {
    const wells = focus?.wellKeys || [];
    const title = wells.length === 1
      ? `Well ${wells[0]}`
      : wells.length > 1
        ? `${wells.length} wells`
        : fitMode === "plate"
          ? "Full plate"
          : "Job path";
    ctx.save();
    ctx.font = `600 13px ${FONT}`;
    const w = Math.ceil(ctx.measureText(title).width) + 20;
    roundRect(ctx, 12, 12, w, 28, 8);
    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    ctx.fill();
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#0f172a";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(title, 22, 26);
    ctx.restore();
  }

  function drawLegend(ctx, ch, zBounds) {
    const minZ = zBounds?.minZ;
    const maxZ = zBounds?.maxZ;
    const hasSpan = Number.isFinite(minZ) && Number.isFinite(maxZ) && maxZ - minZ > 0.02;
    const barH = 96;
    const boxW = 132;
    const boxH = barH + 36;
    const x = 12;
    const y = ch - boxH - 36;
    ctx.save();
    roundRect(ctx, x, y, boxW, boxH, 8);
    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
    ctx.fill();
    ctx.strokeStyle = "#e2e8f0";
    ctx.stroke();
    ctx.font = `12px ${FONT}`;
    ctx.fillStyle = "#334155";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("Z height", x + 12, y + 16);
    const barX = x + 12;
    const barY = y + 28;
    const barW = 14;
    const z0 = hasSpan ? minZ : 0.1;
    const z1 = hasSpan ? maxZ : 0.6;
    const slices = 48;
    for (let i = 0; i < slices; i += 1) {
      const u = i / (slices - 1);
      const z = z1 - u * (z1 - z0);
      ctx.fillStyle = zColor(z, { minZ: z0, maxZ: z1 });
      ctx.fillRect(barX, barY + u * barH, barW, (barH / slices) + 0.5);
    }
    ctx.fillStyle = "#334155";
    ctx.font = `11px ${FONT}`;
    ctx.fillText(`${z1.toFixed(2)} mm`, barX + 20, barY + 6);
    ctx.fillText(`${z0.toFixed(2)} mm`, barX + 20, barY + barH - 4);
    ctx.restore();
  }

  function drawMiniMap(ctx, plate, focus, view, cw) {
    const all = plateBounds(plate);
    const spanX = all.maxX - all.minX;
    const spanY = all.maxY - all.minY;
    const boxW = 92;
    const boxH = boxW * (spanY / spanX);
    const x = cw - boxW - 14;
    const y = 12;
    const scale = Math.min((boxW - 12) / spanX, (boxH - 12) / spanY);
    const ox = x + (boxW - spanX * scale) / 2;
    const oy = y + (boxH - spanY * scale) / 2;
    const toMini = (mx, my) => ({
      px: ox + (mx - all.minX) * scale,
      py: oy + (all.maxY - my) * scale,
    });

    ctx.save();
    roundRect(ctx, x, y, boxW, boxH, 8);
    ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
    ctx.fill();
    ctx.strokeStyle = "#e2e8f0";
    ctx.stroke();

    const active = new Set(focus?.wellKeys || []);
    Object.entries(plate.wellCenters || {}).forEach(([key, [wx, wy]]) => {
      const p = toMini(wx, wy);
      const r = Math.max(2.2, (plate.wellRadiusMm || 7) * scale);
      ctx.beginPath();
      ctx.arc(p.px, p.py, r, 0, Math.PI * 2);
      ctx.fillStyle = active.has(key) ? "#fecaca" : "#e2e8f0";
      ctx.fill();
      ctx.strokeStyle = active.has(key) ? "#dc2626" : "#cbd5e1";
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    const a = toMini(view.minX, view.maxY);
    const b = toMini(view.maxX, view.minY);
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 1.2;
    ctx.strokeRect(a.px, a.py, b.px - a.px, b.py - a.py);
    ctx.restore();
  }

  function render(canvas, zCanvas, state) {
    if (!canvas) return;
    const { ctx, cw, ch } = sizeCanvas(canvas);
    if (zCanvas) sizeCanvas(zCanvas);
    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(0, 0, cw, ch);

    const plate = state.plate;
    if (!plate) {
      ctx.fillStyle = "#64748b";
      ctx.font = `14px ${FONT}`;
      ctx.fillText("Load G-code to simulate micropipette needle motion.", 24, 40);
      renderZStrip(zCanvas, null, state.zBounds, state.wellBottomZ ?? WELL_RIM_Z);
      return;
    }

    const fitMode = state.fitMode || "job";
    const bounds = viewBounds(plate, state.focus, fitMode);
    const margin = state.focus?.wellKeys?.length === 1 ? 16 : 28;
    const map = (x, y) => mmToPx(x, y, bounds, cw, ch, margin);
    const activeWells = new Set(state.focus?.wellKeys || []);
    const hydrogelWells = new Set(state.hydrogelWellKeys || []);

    const a = map(bounds.minX, bounds.maxY);
    const b = map(bounds.maxX, bounds.minY);
    roundRect(ctx, a.px, a.py, b.px - a.px, b.py - a.py, 16);
    ctx.fillStyle = "#e8eef4";
    ctx.fill();

    Object.entries(plate.wellCenters || {}).forEach(([key, [cx, cy]]) => {
      const p = map(cx, cy);
      const r = (plate.wellRadiusMm || plate.wellDiamMm / 2) * p.scale;
      if (p.px + r < -8 || p.px - r > cw + 8 || p.py + r < -8 || p.py - r > ch + 8) return;
      drawWell(ctx, p, r, key, activeWells.has(key), hydrogelWells.has(key) ? state.hydrogelHeightMm : 0);
    });

    if (state.showCompletedMoves !== false) {
      drawTrail(ctx, state.trail, map, state.zBounds, state);
      if (state.showDensity) {
        const maxDensity = Math.max(1e-12, ...(state.dispensePoints || []).map((point) => Number(point.densityValue) || 0));
        (state.dispensePoints || []).forEach((point) => {
          if (point.x == null || point.y == null) return;
          const p = map(point.x, point.y);
          const radius = Math.max(10, Math.min(28, p.scale * 0.7));
          const intensity = Math.max(0, Math.min(1, (Number(point.densityValue) || 0) / maxDensity));
          const gradient = ctx.createRadialGradient(p.px, p.py, 0, p.px, p.py, radius);
          gradient.addColorStop(0, `rgba(190, 24, 93, ${0.08 + intensity * 0.34})`);
          gradient.addColorStop(1, "rgba(190, 24, 93, 0)");
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(p.px, p.py, radius, 0, Math.PI * 2);
          ctx.fill();
        });
      }
      ctx.fillStyle = "#f97316";
      (state.dispensePoints || []).forEach((point) => {
        if (point.x == null || point.y == null) return;
        const p = map(point.x, point.y);
        ctx.beginPath();
        ctx.arc(p.px, p.py, 3.2, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    const sample = state.sample;
    if (sample && sample.x != null && sample.y != null) {
      const p = map(sample.x, sample.y);
      drawHead(ctx, p, sample.displayKind === "dispense", sample.z, p.scale, state.zBounds);
    }

    drawHud(ctx, state.focus, fitMode);
    drawLegend(ctx, ch, state.zBounds);
    drawScaleBar(ctx, map, bounds, cw, ch);
    if (fitMode !== "plate") drawMiniMap(ctx, plate, state.focus, bounds, cw);

    renderZStrip(zCanvas, sample, state.zBounds, state.wellBottomZ ?? WELL_RIM_Z);
  }

  function renderZStrip(canvas, sample, zBounds, wellRimZ) {
    if (!canvas) return;
    const { ctx, cw, ch } = sizeCanvas(canvas);
    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = "#f1f5f9";
    ctx.fillRect(0, 0, cw, ch);

    const rimZ = Number.isFinite(wellRimZ) ? wellRimZ : WELL_RIM_Z;
    let minZ = Number.isFinite(zBounds?.minZ) ? zBounds.minZ : WELL_FLOOR_Z;
    let maxZ = Number.isFinite(zBounds?.maxZ) ? zBounds.maxZ : 8;
    minZ = Math.min(minZ, WELL_FLOOR_Z);
    maxZ = Math.max(maxZ, rimZ, minZ + 0.2);
    const top = 28;
    const bottom = ch - 28;
    const span = Math.max(maxZ - minZ, 0.01);
    const zToY = (z) => bottom - ((z - minZ) / span) * (bottom - top);

    roundRect(ctx, cw / 2 - 7, top, 14, bottom - top, 7);
    ctx.save();
    ctx.clip();
    const slices = Math.max(24, Math.round(bottom - top));
    for (let i = 0; i < slices; i += 1) {
      const u = i / (slices - 1);
      const z = maxZ - u * (maxZ - minZ);
      ctx.fillStyle = zColor(z, { minZ, maxZ });
      ctx.fillRect(cw / 2 - 7, top + u * (bottom - top), 14, (bottom - top) / slices + 0.5);
    }
    ctx.restore();
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1;
    roundRect(ctx, cw / 2 - 7, top, 14, bottom - top, 7);
    ctx.stroke();

    const drawRef = (z, label, color) => {
      if (!Number.isFinite(z)) return;
      const y = zToY(z);
      if (y < top - 8 || y > bottom + 8) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(8, y);
      ctx.lineTo(cw - 8, y);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.font = `9px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      const nearFloor = y > bottom - 18;
      ctx.fillText(label, cw / 2, nearFloor ? y - 5 : y - 4);
    };
    drawRef(rimZ, "well rim", "#b45309");
    drawRef(WELL_FLOOR_Z, "well bottom", "#92400e");

    ctx.fillStyle = "#334155";
    ctx.font = `11px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("Z", cw / 2, 16);
    ctx.fillText(maxZ.toFixed(1), cw / 2, top - 6);
    ctx.fillText(minZ.toFixed(1), cw / 2, ch - 10);

    if (sample && sample.z != null && Number.isFinite(sample.z)) {
      const y = zToY(sample.z);
      ctx.beginPath();
      ctx.arc(cw / 2, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = zColor(sample.z, { minZ, maxZ });
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = "#0f172a";
      ctx.font = `11px ${FONT}`;
      const valueY = y < top + 18 ? y + 18 : y - 12;
      ctx.fillText(`${sample.z.toFixed(2)}`, cw / 2, valueY);
    }
  }

  root.GcodeSimulator2D = { render, renderZStrip, plateBounds, viewBounds, mmToPx };
})(typeof globalThis !== "undefined" ? globalThis : this);
