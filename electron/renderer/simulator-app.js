(function (root) {
  const SPEEDS = [0.5, 1, 2, 5, 10, 50];
  const DEFAULT_SPEED = 10;

  function $(id) {
    return document.getElementById(id);
  }

  function formatTime(seconds) {
    const s = Math.max(0, Number(seconds) || 0);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    if (hrs > 0) return `${hrs}:${String(mins).padStart(2, "0")}:${secs.toFixed(1).padStart(4, "0")}`;
    return `${mins}:${secs.toFixed(1).padStart(4, "0")}`;
  }

  function formatCoord(value) {
    if (value == null || !Number.isFinite(value)) return "—";
    return Number(value).toFixed(2);
  }

  function formatCount(value, digits = 0) {
    if (value == null || !Number.isFinite(value)) return "—";
    return value.toLocaleString(undefined, { maximumFractionDigits: digits });
  }

  function formatFeeds(feeds) {
    if (!feeds?.length) return "—";
    return feeds.map((f) => `F${f}`).join(", ");
  }

  function createSimulatorApp() {
    const els = {
      dropzone: $("simulator-dropzone"),
      open: $("simulator-open"),
      clear: $("simulator-clear"),
      fileName: $("simulator-file-name"),
      text: $("simulator-text"),
      view: $("simulator-view"),
      cameraAngle: $("simulator-camera-angle"),
      speed: $("simulator-speed"),
      play: $("simulator-play"),
      pause: $("simulator-pause"),
      reset: $("simulator-reset"),
      scrub: $("simulator-scrub"),
      status: $("simulator-status"),
      sourceLabel: $("simulator-source-label"),
      canvas: $("simulator-canvas"),
      zCanvas: $("simulator-z"),
      host3d: $("simulator-3d"),
      fit: $("simulator-fit"),
      showCompleted: $("simulator-show-completed"),
      showTravel: $("simulator-show-travel"),
      showZMoves: $("simulator-show-z-moves"),
      plateType: $("simulator-plate-type") || $("plate-type"),
      refresh: $("simulator-refresh"),
      wrap2d: $("simulator-2d-wrap"),
      stats: $("simulator-stats"),
      exposure: $("simulator-exposure"),
      hydrogelVolume: $("simulator-hydrogel-volume"),
      hydrogelHeight: $("simulator-hydrogel-height"),
      experimentMode: $("simulator-mode-experiment"),
      machineMode: $("simulator-mode-machine"),
      experimentSetup: $("simulator-experiment-setup"),
      contextLabel: $("simulator-context-label"),
      actionTitle: $("simulator-action-title"),
      progressSummary: $("simulator-progress-summary"),
      progressFill: $("simulator-progress-fill"),
      showDensity: $("simulator-show-density"),
      sectionControls: $("simulator-section-controls"),
      sectionHeight: $("simulator-section-height"),
      sectionValue: $("simulator-section-value"),
      wellProfile: $("simulator-well-profile"),
      densityLegend: $("simulator-density-legend"),
      sidePlacement: $("simulator-side-placement"),
      preflight: $("simulator-preflight"),
      injections: $("simulator-injections"),
      needleRatio: $("simulator-needle-ratio"),
      cellConcentration: $("simulator-cell-concentration"),
      densityMode: $("simulator-density-mode"),
      densityOptions: $("simulator-density-options"),
      densityTotal: $("simulator-density-total"),
    };

    let options = {};
    let motion = { events: [], durationSec: 0, bounds: {}, counts: {} };
    let summary = null;
    let plate = null;
    let t = 0;
    let playing = false;
    let speed = DEFAULT_SPEED;
    let lastTs = 0;
    let view3d = null;
    let threeLoading = false;
    let gcodeText = "";
    let sourceLabel = "No G-code loaded";
    let perspective = "experiment";
    let preflightReport = null;
    let selectedInjectionIndex = null;
    let rafId = 0;
    const followCam = {
      wellKey: null,
      displayed: null,
      from: null,
      to: null,
      start: 0,
      ms: 850,
    };

    function motionLib() {
      return root.GcodeMotion;
    }

    function picoLib() {
      return root.PicoSimulator;
    }

    function core() {
      return root.GcodeCore;
    }

    function currentPlateTypeId() {
      if (typeof options.getPlateTypeId === "function") return options.getPlateTypeId();
      return els.plateType?.value || core()?.DEFAULT_PLATE_TYPE_ID || "24-well";
    }

    function resolvePlate() {
      const api = core()?.createPlateApi?.(currentPlateTypeId());
      plate = api || null;
      updateHydrogelHeight();
    }

    function hydrogelHeightMm() {
      return core()?.hydrogelFillHeightMm?.(
        Number(els.hydrogelVolume?.value) || 0,
        plate?.wellDiamMm || 0
      ) || 0;
    }

    function updateHydrogelHeight() {
      const height = hydrogelHeightMm();
      const depth = Number(plate?.wellDepthMm || 15);
      const capacityUl = Math.PI * ((Number(plate?.wellDiamMm || 0) / 2) ** 2) * depth;
      if (els.hydrogelHeight) {
        const overfill = height > depth ? " — exceeds well depth" : "";
        els.hydrogelHeight.textContent = `Hydrogel height: ${height.toFixed(2)} mm of ${depth.toFixed(2)} mm well depth · cylindrical capacity ${capacityUl.toFixed(0)} µL${overfill}`;
      }
      if (els.sectionHeight) {
        els.sectionHeight.max = String(Math.max(0.05, height));
        if (Number(els.sectionHeight.value) > height) els.sectionHeight.value = String(height / 2);
        if (els.sectionValue) els.sectionValue.textContent = `${Number(els.sectionHeight.value).toFixed(2)} mm`;
      }
    }

    function renderPreflight() {
      if (!els.preflight || !els.injections) return;
      preflightReport = picoLib()?.preflightMotion?.(motion, plate, hydrogelHeightMm()) || null;
      const report = preflightReport;
      if (!report?.injections?.length) {
        els.preflight.innerHTML = `<p class="note">Preflight checks appear after G-code is loaded.</p>`;
        els.injections.innerHTML = "";
        return;
      }
      const warningCount = report.warnings.length;
      const statusClass = warningCount ? "warning" : "pass";
      const headline = warningCount ? `${warningCount} preflight warning${warningCount === 1 ? "" : "s"}` : "Preflight passed";
      const warningItems = report.warnings.slice(0, 5).map((warning) => `<li>${warning.injectionIndex ? `Injection ${warning.injectionIndex}: ` : ""}${warning.message}</li>`).join("");
      els.preflight.innerHTML = `<div class="simulator-preflight-head ${statusClass}"><strong>${headline}</strong><span>${report.injections.length} injections checked</span></div><dl><div><dt>Minimum bottom clearance</dt><dd>${formatCoord(report.minimumBottomClearanceMm)} mm</dd></div><div><dt>Maximum travel Z</dt><dd>${formatCoord(report.maximumTravelZMm)} mm</dd></div></dl>${warningItems ? `<ul>${warningItems}</ul>` : `<p>All dispense points are inside a well and within the calculated hydrogel volume.</p>`}`;
      els.injections.innerHTML = `<div class="simulator-injection-head"><strong>Injection inspector</strong><span>Select a point to jump playback</span></div><div class="simulator-injection-list">${report.injections.map((injection) => {
        const selected = injection.index === selectedInjectionIndex;
        const state = injection.issues.length ? "warning" : "safe";
        const zLabel = Number.isFinite(injection.zStart) && Number.isFinite(injection.zEnd)
          ? `${formatCoord(injection.zStart)}→${formatCoord(injection.zEnd)}`
          : formatCoord(injection.z);
        return `<button type="button" data-injection-index="${injection.index}" class="${state}${selected ? " selected" : ""}"><b>${injection.index}</b><span>${injection.wellKey}</span><span>X ${formatCoord(injection.x)}</span><span>Y ${formatCoord(injection.y)}</span><span>Z ${zLabel}</span></button>`;
      }).join("")}</div>`;
    }

    function nearestWell(x, y) {
      if (!plate?.wellCenters || !Number.isFinite(x) || !Number.isFinite(y)) return "—";
      let best = "—";
      let bestDistance = Infinity;
      Object.entries(plate.wellCenters).forEach(([key, center]) => {
        const cx = Array.isArray(center) ? center[0] : center.x;
        const cy = Array.isArray(center) ? center[1] : center.y;
        const distance = Math.hypot(x - cx, y - cy);
        if (distance < bestDistance) {
          best = key;
          bestDistance = distance;
        }
      });
      return bestDistance <= Number(plate.wellDiamMm || 0) / 2 + 2 ? best : "Between wells";
    }

    function wellCenter(key) {
      const center = plate?.wellCenters?.[key];
      if (!center) return null;
      return { x: Array.isArray(center) ? center[0] : center.x, y: Array.isArray(center) ? center[1] : center.y };
    }

    function actionLabel(kind) {
      return kind === "dispense" ? "Dispensing into hydrogel"
        : kind === "travel" ? "Moving to the next position"
          : kind === "zMove" ? "Approaching or retracting microcapillary"
            : kind === "dwell" ? "Dispense dwell"
              : "Ready to simulate";
    }

    function dispenseEvents() {
      return motion.events.filter((event) => event.eDelta > 0);
    }

    function followingDwellSec(eventIndex) {
      const next = motion.events[eventIndex + 1];
      if (!next || (next.displayKind || next.kind) !== "dwell") return 0;
      return Math.max(0, (next.t1 || 0) - (next.t0 || 0));
    }

    function densityMeasurement(event, eventIndex) {
      const mode = els.densityMode?.value || "count";
      const ratio = Math.max(0.0001, Number(els.needleRatio?.value) || 1.05);
      const concentration = Math.max(0, Number(els.cellConcentration?.value) || 0);
      const volumeUl = Math.max(0, Number(event.eDelta) || 0) / ratio;
      const dwellSec = followingDwellSec(eventIndex);
      if (mode === "volume") return { value: volumeUl, unit: "µL" };
      if (mode === "cells") return { value: volumeUl * concentration, unit: "cells" };
      if (mode === "dwell") return { value: volumeUl * dwellSec, unit: "µL·s" };
      return { value: 1, unit: "injections" };
    }

    function updateDensityTotal(points) {
      if (!els.densityTotal) return;
      const total = points.reduce((sum, point) => sum + (Number(point.densityValue) || 0), 0);
      const unit = points[0]?.densityUnit || (els.densityMode?.value === "cells" ? "cells" : "");
      const digits = unit === "µL" || unit === "µL·s" ? 4 : 1;
      els.densityTotal.textContent = `Total ${formatCount(total, digits)} ${unit}`;
    }

    function treatmentDepthMm() {
      const values = dispenseEvents().map((event) => {
        const z0 = Number(event.from?.z);
        const z1 = Number(event.to?.z);
        if (Number.isFinite(z0) && Number.isFinite(z1)) return (z0 + z1) / 2;
        return Number.isFinite(z1) ? z1 : z0;
      }).filter(Number.isFinite).sort((a, b) => a - b);
      if (!values.length) return null;
      const mid = Math.floor(values.length / 2);
      return values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
    }

    function treatmentFocus(sample) {
      if (!Number.isFinite(sample?.x) || !Number.isFinite(sample?.y)) return null;
      const wellKey = nearestWell(sample.x, sample.y);
      return {
        wellKeys: wellKey !== "—" && wellKey !== "Between wells" ? [wellKey] : [],
        treatmentFocus: true,
        center: { x: sample.x, y: sample.y, z: Number.isFinite(sample.z) ? sample.z : treatmentDepthMm() || 2 },
        spanX: 4,
        spanY: 4,
        radius: 7,
      };
    }

    function completedDispensePoints() {
      const points = motion.events
        .map((event, eventIndex) => ({ event, eventIndex }))
        .filter(({ event }) => event.eDelta > 0 && event.t1 <= t)
        .map(({ event, eventIndex }) => {
          const density = densityMeasurement(event, eventIndex);
          const zStart = Number(event.from?.z);
          const zEnd = Number(event.to?.z);
          const z = Number.isFinite(zStart) && Number.isFinite(zEnd) ? (zStart + zEnd) / 2 : event.to?.z;
          return { x: event.to?.x, y: event.to?.y, z, zStart, zEnd, eDelta: event.eDelta, densityValue: density.value, densityUnit: density.unit };
        });
      updateDensityTotal(points);
      return points;
    }

    function fullPlateFocus() {
      if (!plate) return null;
      const bounds = root.GcodeSimulator2D?.plateBounds?.(plate);
      if (!bounds) return null;
      const spanX = Math.max(1, bounds.maxX - bounds.minX);
      const spanY = Math.max(1, bounds.maxY - bounds.minY);
      return {
        wellKeys: [],
        fullPlate: true,
        center: {
          x: (bounds.minX + bounds.maxX) / 2,
          y: (bounds.minY + bounds.maxY) / 2,
          z: Number(plate.wellDepthMm || 15) / 2,
        },
        spanX,
        spanY,
        radius: Math.hypot(spanX, spanY) * 0.72,
      };
    }

    function setPerspective(mode) {
      perspective = mode === "machine" ? "machine" : "experiment";
      document.body.dataset.simulatorPerspective = perspective;
      els.experimentMode?.classList.toggle("active", perspective === "experiment");
      els.machineMode?.classList.toggle("active", perspective === "machine");
      els.experimentMode?.setAttribute("aria-pressed", String(perspective === "experiment"));
      els.machineMode?.setAttribute("aria-pressed", String(perspective === "machine"));
      if (els.contextLabel) els.contextLabel.textContent = perspective === "experiment" ? "EXPERIMENT VIEW" : "MACHINE VIEW";
      updateStatus();
    }

    function renderExperimentSummary(sample) {
      const volume = Number(els.hydrogelVolume?.value) || 0;
      const height = hydrogelHeightMm();
      const dispenses = dispenseEvents();
      const completed = dispenses.filter((event) => event.t1 <= t).length;
      const well = nearestWell(sample.x, sample.y);
      const plateLabel = plate?.label || `${plate?.rows || 0} × ${plate?.cols || 0} well plate`;
      const treatedWells = new Set(dispenses.map((event) => nearestWell(event.to?.x, event.to?.y)).filter((key) => key !== "—" && key !== "Between wells"));
      const activeWell = well === "Between wells" ? "—" : well;
      const depth = treatmentDepthMm();
      const totalPath = (Number(summary?.treatmentPathLengthMm) || 0) + (Number(summary?.travelPathLengthMm) || 0);
      if (els.experimentSetup) {
        const plateCells = (plate?.wellKeys || []).map((key) => `<b class="${treatedWells.has(key) ? "treated" : ""}" aria-label="Well ${key}${treatedWells.has(key) ? ", treated" : ""}">${key}</b>`).join("");
        els.experimentSetup.innerHTML = `<div><span>Plate / current well</span><strong>${plateLabel} · ${activeWell}</strong></div><div><span>Material volume</span><strong>${formatCount(volume)} µL · ${height.toFixed(2)} mm high</strong></div><div><span>Motion</span><strong>${formatCount(dispenses.length)} dispense points</strong></div><div><span>Treatment depth</span><strong>${formatCoord(depth)} mm</strong></div><div><span>Runtime</span><strong>${formatTime(summary?.durationSec)}</strong></div><div><span>Total path</span><strong>${formatCoord(totalPath)} mm</strong></div><div class="simulator-plate-overview"><span>Treated-well overview</span><div>${plateCells}</div></div>`;
      }
      if (els.actionTitle) els.actionTitle.textContent = actionLabel(sample.displayKind);
      if (els.progressSummary) els.progressSummary.textContent = `${well} · ${completed} of ${dispenses.length} dispense actions · ${formatTime(sample.t)} of ${formatTime(sample.durationSec)}`;
      const progress = sample.durationSec ? Math.max(0, Math.min(100, sample.t / sample.durationSec * 100)) : 0;
      if (els.progressFill) els.progressFill.style.width = `${progress}%`;
      els.progressFill?.parentElement?.setAttribute("aria-valuenow", String(Math.round(progress)));
      if (els.wellProfile) {
        const wellDepth = Number(plate?.wellDepthMm || 15);
        const fillPct = Math.min(100, Math.max(0, height / wellDepth * 100));
        const tipPct = Number.isFinite(sample.z) ? Math.min(100, Math.max(0, sample.z / wellDepth * 100)) : 0;
        const treatmentPct = Number.isFinite(depth) ? Math.min(100, Math.max(0, depth / wellDepth * 100)) : 0;
        const profileCenter = wellCenter(activeWell);
        const wellRadius = Number(plate?.wellRadiusMm || plate?.wellDiamMm / 2 || 1);
        const tipXPct = profileCenter && Number.isFinite(sample.x)
          ? Math.min(100, Math.max(0, 50 + ((sample.x - profileCenter.x) / (wellRadius * 2)) * 100))
          : 50;
        const ticks = [15, 10, 5, 0].map((z) => `<i style="bottom:${z / wellDepth * 100}%"><span>${z} mm</span></i>`).join("");
        els.wellProfile.innerHTML = `<div class="well-profile-labels"><strong>X–Z depth profile</strong><span><b class="profile-key tip"></b>Capillary: X ${formatCoord(sample.x)}, Z ${formatCoord(sample.z)} mm</span><span><b class="profile-key gel"></b>Hydrogel top: ${height.toFixed(2)} mm</span><span><b class="profile-key treatment"></b>Treatment plane: ${formatCoord(depth)} mm</span><span>Well depth: ${wellDepth.toFixed(2)} mm</span></div><div class="well-profile-ruler"><div class="well-profile-vessel">${ticks}<div class="well-profile-gel" style="height:${fillPct}%"></div><div class="well-profile-treatment" style="bottom:${treatmentPct}%"></div><div class="well-profile-tip" style="bottom:${tipPct}%;left:${tipXPct}%"></div></div><span class="well-profile-bottom">X position across well · Z 0 bottom</span></div>`;
      }
      if (els.sidePlacement) {
        const side = els.cameraAngle?.value === "side" && (els.view?.value || "2d") === "3d";
        els.sidePlacement.hidden = !side;
        if (side) {
          const center = wellCenter(activeWell);
          const xOffset = center && Number.isFinite(sample.x) ? sample.x - center.x : null;
          const inGel = Number.isFinite(sample.z) && sample.z >= 0 && sample.z <= height;
          els.sidePlacement.innerHTML = `<strong>Capillary tip placement · X–Z side projection</strong><span>Well ${activeWell}</span><span>X ${formatCoord(sample.x)} mm</span><span>X offset ${xOffset == null ? "—" : `${xOffset >= 0 ? "+" : ""}${xOffset.toFixed(2)}`} mm</span><span>Z depth ${formatCoord(sample.z)} mm</span><span class="${inGel ? "inside" : "outside"}">${inGel ? `Inside hydrogel · ${(height - sample.z).toFixed(2)} mm below surface` : "Outside hydrogel"}</span>`;
        }
      }
    }

    function lerpNum(a, b, u) {
      return a + (b - a) * u;
    }

    function easeInOut(u) {
      return u < 0.5 ? 2 * u * u : 1 - ((-2 * u + 2) ** 2) / 2;
    }

    function lerpFocus(a, b, u) {
      if (!a) return b;
      if (!b) return a;
      return {
        wellKeys: u < 0.5 ? a.wellKeys : b.wellKeys,
        center: {
          x: lerpNum(a.center.x, b.center.x, u),
          y: lerpNum(a.center.y, b.center.y, u),
          z: lerpNum(a.center.z ?? 2, b.center.z ?? 2, u),
        },
        spanX: lerpNum(a.spanX, b.spanX, u),
        spanY: lerpNum(a.spanY, b.spanY, u),
        radius: lerpNum(a.radius, b.radius, u),
      };
    }

    function unionFocus(a, b) {
      if (!a) return b;
      if (!b) return a;
      const minX = Math.min(a.center.x - a.spanX / 2, b.center.x - b.spanX / 2);
      const maxX = Math.max(a.center.x + a.spanX / 2, b.center.x + b.spanX / 2);
      const minY = Math.min(a.center.y - a.spanY / 2, b.center.y - b.spanY / 2);
      const maxY = Math.max(a.center.y + a.spanY / 2, b.center.y + b.spanY / 2);
      const spanX = Math.max(maxX - minX, 8);
      const spanY = Math.max(maxY - minY, 8);
      return {
        wellKeys: [...new Set([...(a.wellKeys || []), ...(b.wellKeys || [])])],
        center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: 2 },
        spanX,
        spanY,
        radius: Math.max(spanX, spanY) * 1.05,
      };
    }

    function zoomOutInFocus(from, to, u) {
      const mid = unionFocus(from, to);
      const e = easeInOut(Math.max(0, Math.min(1, u)));
      if (e < 0.5) return lerpFocus(from, mid, e * 2);
      return lerpFocus(mid, to, (e - 0.5) * 2);
    }

    function resetFollowCam() {
      followCam.wellKey = null;
      followCam.displayed = null;
      followCam.from = null;
      followCam.to = null;
      followCam.start = 0;
    }

    function followFocus(target) {
      if (!target?.center) return target;
      const key = (target.wellKeys || []).join(",") || "path";
      if (!followCam.displayed) {
        followCam.displayed = target;
        followCam.wellKey = key;
        return target;
      }
      if (key !== followCam.wellKey) {
        followCam.from = followCam.displayed;
        followCam.to = target;
        followCam.start = performance.now();
        followCam.wellKey = key;
      }
      if (followCam.start) {
        const u = Math.min(1, (performance.now() - followCam.start) / followCam.ms);
        followCam.displayed = zoomOutInFocus(followCam.from, followCam.to, u);
        if (u >= 1) followCam.start = 0;
        return followCam.displayed;
      }
      followCam.displayed = target;
      return target;
    }

    function parseAndLoad(text, label) {
      gcodeText = String(text || "");
      sourceLabel = label || "Loaded G-code";
      const parsed = picoLib().annotatePicoMotion(motionLib().parseGcodeMotion(gcodeText));
      motion = parsed;
      summary = picoLib().summarizePicoMotion(parsed);
      t = 0;
      playing = false;
      resetFollowCam();
      if (els.fileName) els.fileName.textContent = sourceLabel;
      if (els.sourceLabel) els.sourceLabel.textContent = sourceLabel;
      if (els.text && els.text.value !== gcodeText) els.text.value = gcodeText;
      if (els.scrub) {
        els.scrub.max = String(Math.max(parsed.durationSec, 0.001));
        els.scrub.value = "0";
      }
      resolvePlate();
      selectedInjectionIndex = null;
      renderPreflight();
      draw();
    }

    function sampleState() {
      const sample = motionLib().sampleTimeline(motion, t);
      const trail = motionLib().trailPoints(motion, t, 4000);
      const dispensePoints = completedDispensePoints();
      const fitMode = els.fit?.value || "job";
      const targetFocus = fitMode === "plate"
        ? fullPlateFocus()
        : fitMode === "treatment"
          ? treatmentFocus(sample)
          : (picoLib()?.liveFocusRegion?.(motion, plate, t) || picoLib()?.focusRegion?.(motion, plate));
      const focus = fitMode === "plate" ? targetFocus : followFocus(targetFocus);
      const hydrogelWellKeys = [...new Set((preflightReport?.injections || [])
        .map((injection) => injection.wellKey)
        .filter((key) => key && key !== "—"))];
      return {
        plate,
        sample,
        trail,
        zBounds: motion.bounds,
        wellBottomZ: core()?.WELL_BOTTOM_Z,
        focus: focus || null,
        fitMode,
        showCompletedMoves: els.showCompleted ? els.showCompleted.checked : true,
        showTravelMoves: Boolean(els.showTravel?.checked),
        showZMoves: Boolean(els.showZMoves?.checked),
        dispensePoints,
        hydrogelHeightMm: hydrogelHeightMm(),
        hydrogelVolumeUl: Number(els.hydrogelVolume?.value) || 0,
        hydrogelWellKeys,
        sectionMode: els.cameraAngle?.value === "section",
        sectionHeightMm: Number(els.sectionHeight?.value) || 0,
        showDensity: Boolean(els.showDensity?.checked),
        sideProjection: els.cameraAngle?.value === "side",
        cameraFollow: fitMode === "treatment" || (fitMode !== "plate" && Boolean(followCam.start)),
      };
    }

    function renderStats() {
      if (!els.stats) return;
      if (!summary || !motion.events.length) {
        els.stats.innerHTML = "<p class=\"note\">Motion statistics appear after G-code is loaded.</p>";
        return;
      }
      const rows = [
        ["Total runtime", formatTime(summary.durationSec)],
        ["Dispensing-motion time", formatTime(summary.treatmentTimeSec)],
        ["Travel time", formatTime(summary.travelTimeSec)],
        ["Dwell time", formatTime(summary.dwellTimeSec)],
        ["Z-move time", formatTime(summary.zMoveTimeSec)],
        ["Dispensing path length", `${formatCoord(summary.treatmentPathLengthMm)} mm`],
        ["Travel path length", `${formatCoord(summary.travelPathLengthMm)} mm`],
        ["Dispense actions", formatCount(motion.events.filter((event) => event.eDelta > 0).length)],
        ["Total extrusion (E)", formatCount(motion.events.reduce((total, event) => total + Math.max(0, event.eDelta || 0), 0), 4)],
        ["Min / max Z", `${formatCoord(summary.minZ)} / ${formatCoord(summary.maxZ)} mm`],
        ["Active feed rates", formatFeeds(summary.feedRatesMmMin)],
      ];
      els.stats.innerHTML = `<dl class="simulator-stats-list">${rows.map(([k, v]) => (
        `<div><dt>${k}</dt><dd>${v}</dd></div>`
      )).join("")}</dl>`;
    }

    function renderExposure() {
      if (!els.exposure) return;
      if (!summary || !motion.events.length) {
        els.exposure.innerHTML = "<p class=\"note\">Micropipette dispensing details appear after G-code is loaded.</p>";
        return;
      }
      const dispenseEvents = motion.events.filter((event) => event.eDelta > 0);
      const totalE = dispenseEvents.reduce((total, event) => total + event.eDelta, 0);
      els.exposure.innerHTML = `<p><strong>Micropipette dispensing</strong></p><p>${formatCount(dispenseEvents.length)} dispense actions · total E ${formatCount(totalE, 4)}</p>`;
    }

    function updateStatus() {
      const sample = motionLib().sampleTimeline(motion, t);
      renderExperimentSummary(sample);
      const xyz = `X ${formatCoord(sample.x)}  Y ${formatCoord(sample.y)}  Z ${formatCoord(sample.z)}`;
      const feed = sample.f ? `F ${sample.f}` : "F —";
      const time = `${formatTime(sample.t)} / ${formatTime(sample.durationSec)}`;
      const role = sample.displayKind === "dispense"
        ? "dispensing"
        : sample.displayKind === "travel"
          ? "travel"
          : sample.displayKind === "zMove"
            ? "Z move"
            : sample.displayKind === "dwell"
              ? "dwell"
              : "idle";
      if (els.status) {
        els.status.textContent = perspective === "machine"
          ? `${time}  ·  ${xyz}  ·  ${feed}  ·  ${role}  ·  ${speed}×`
          : `${actionLabel(sample.displayKind)} · ${nearestWell(sample.x, sample.y)} · ${speed}× playback`;
      }
      if (els.scrub && document.activeElement !== els.scrub) {
        els.scrub.value = String(t);
      }
      if (els.play) els.play.disabled = !motion.durationSec;
      if (els.pause) els.pause.disabled = !playing;
      renderStats();
      renderExposure();
    }

    function draw() {
      const state = sampleState();
      const mode = els.view?.value || "2d";
      if (els.wrap2d) els.wrap2d.hidden = mode === "3d";
      if (els.host3d) els.host3d.hidden = mode !== "3d";
      if (mode === "3d") {
        if (view3d) view3d.render(state);
        root.GcodeSimulator2D.renderZStrip?.(
          els.zCanvas,
          state.sample,
          state.zBounds,
          state.wellBottomZ
        );
      } else {
        root.GcodeSimulator2D.render(els.canvas, els.zCanvas, state);
      }
      updateStatus();
    }

    function tick(ts) {
      rafId = requestAnimationFrame(tick);
      if (!playing) {
        lastTs = ts;
        if (followCam.start) draw();
        return;
      }
      const dt = Math.min(0.05, (ts - lastTs) / 1000);
      lastTs = ts;
      t += dt * speed;
      if (t >= motion.durationSec) {
        t = motion.durationSec;
        playing = false;
      }
      draw();
    }

    function ensureLoop() {
      if (!rafId) rafId = requestAnimationFrame(tick);
    }

    function loadThree(done) {
      if (root.THREE) {
        done();
        return;
      }
      if (threeLoading) return;
      const existing = document.querySelector("script[data-three]");
      if (existing) {
        existing.addEventListener("load", done);
        return;
      }
      threeLoading = true;
      const script = document.createElement("script");
      script.src = "./vendor/three.min.js";
      script.dataset.three = "1";
      script.onload = () => {
        threeLoading = false;
        done();
      };
      script.onerror = () => {
        threeLoading = false;
        if (els.status) els.status.textContent = "Could not load 3D library; staying on 2D.";
        if (els.view) els.view.value = "2d";
      };
      document.head.appendChild(script);
    }

    function setView(mode) {
      if (els.view) els.view.value = mode;
      if (els.wrap2d) els.wrap2d.hidden = mode === "3d";
      if (els.host3d) els.host3d.hidden = mode !== "3d";
      if (mode === "3d") {
        ensureLoop();
        ensure3d();
      } else {
        draw();
      }
    }

    function ensure3d() {
      ensureLoop();
      if (els.wrap2d) els.wrap2d.hidden = true;
      if (els.host3d) els.host3d.hidden = false;
      const afterLayout = () => {
        view3d?.resize?.();
        draw();
      };
      if (view3d) {
        requestAnimationFrame(afterLayout);
        return;
      }
      const mount = () => {
        view3d = root.GcodeSimulator3D.createView(els.host3d);
        if (!view3d && els.view) {
          els.view.value = "2d";
          if (els.host3d) els.host3d.hidden = true;
          if (els.wrap2d) els.wrap2d.hidden = false;
          if (els.status) els.status.textContent = "3D view is unavailable.";
          draw();
          return;
        }
        view3d.setCameraPreset?.(els.cameraAngle?.value || "depth");
        requestAnimationFrame(afterLayout);
      };
      if (root.THREE) mount();
      else loadThree(mount);
    }

    function bindDropzone() {
      const node = els.dropzone;
      if (!node) return;
      const setActive = (on) => node.classList.toggle("gcode-import-drop-active", on);
      node.addEventListener("click", (event) => {
        if (event.target === els.open) return;
        els.open?.click();
      });
      node.addEventListener("dragover", (event) => {
        event.preventDefault();
        setActive(true);
      });
      node.addEventListener("dragleave", (event) => {
        if (!node.contains(event.relatedTarget)) setActive(false);
      });
      node.addEventListener("drop", async (event) => {
        event.preventDefault();
        setActive(false);
        const file = event.dataTransfer?.files?.[0];
        if (file) await loadFile(file);
      });
    }

    async function loadFile(file) {
      const text = await file.text();
      parseAndLoad(text, file.name);
    }

    function bind() {
      bindDropzone();
      els.open?.addEventListener("click", (event) => {
        event.stopPropagation();
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".gcode,.txt,.nc,.tap";
        input.addEventListener("change", async () => {
          const file = input.files?.[0];
          if (file) await loadFile(file);
        });
        input.click();
      });
      els.clear?.addEventListener("click", () => {
        parseAndLoad("", "No G-code loaded");
      });
      els.text?.addEventListener("change", () => {
        parseAndLoad(els.text.value, "Pasted G-code");
      });
      els.view?.addEventListener("change", () => setView(els.view.value));
      els.cameraAngle?.addEventListener("change", () => {
        view3d?.setCameraPreset?.(els.cameraAngle.value);
        if (els.sectionControls) els.sectionControls.hidden = els.cameraAngle.value !== "section";
        if (els.sidePlacement) els.sidePlacement.hidden = els.cameraAngle.value !== "side" || (els.view?.value || "2d") !== "3d";
        draw();
      });
      els.fit?.addEventListener("change", () => { resetFollowCam(); draw(); });
      els.showCompleted?.addEventListener("change", () => draw());
      els.showTravel?.addEventListener("change", () => draw());
      els.showZMoves?.addEventListener("change", () => draw());
      els.showDensity?.addEventListener("change", () => {
        if (els.densityOptions) els.densityOptions.hidden = !els.showDensity.checked;
        draw();
      });
      els.densityMode?.addEventListener("change", () => draw());
      els.needleRatio?.addEventListener("input", () => { renderPreflight(); draw(); });
      els.cellConcentration?.addEventListener("input", () => draw());
      els.hydrogelVolume?.addEventListener("input", () => {
        updateHydrogelHeight();
        if (els.sectionHeight) {
          const height = hydrogelHeightMm();
          els.sectionHeight.max = String(Math.max(0.05, height));
          if (Number(els.sectionHeight.value) > height) els.sectionHeight.value = String(height / 2);
        }
        renderPreflight();
        draw();
      });
      els.injections?.addEventListener("click", (event) => {
        const button = event.target.closest?.("button[data-injection-index]");
        if (!button) return;
        const index = Number(button.dataset.injectionIndex);
        const injection = preflightReport?.injections?.find((item) => item.index === index);
        if (!injection) return;
        selectedInjectionIndex = index;
        t = injection.timeSec;
        playing = false;
        if (els.fit) els.fit.value = "treatment";
        resetFollowCam();
        renderPreflight();
        draw();
      });
      els.sectionHeight?.addEventListener("input", () => {
        if (els.sectionValue) els.sectionValue.textContent = `${Number(els.sectionHeight.value).toFixed(2)} mm`;
        draw();
      });
      els.experimentMode?.addEventListener("click", () => setPerspective("experiment"));
      els.machineMode?.addEventListener("click", () => setPerspective("machine"));
      els.speed?.addEventListener("change", () => {
        speed = Number(els.speed.value) || DEFAULT_SPEED;
        updateStatus();
      });
      els.play?.addEventListener("click", () => {
        if (!motion.durationSec) return;
        if (t >= motion.durationSec) t = 0;
        playing = true;
        lastTs = performance.now();
        ensureLoop();
      });
      els.pause?.addEventListener("click", () => {
        playing = false;
        updateStatus();
      });
      els.reset?.addEventListener("click", () => {
        t = 0;
        playing = false;
        draw();
      });
      els.scrub?.addEventListener("input", () => {
        t = Number(els.scrub.value) || 0;
        playing = false;
        draw();
      });
      els.plateType?.addEventListener("change", () => {
        resolvePlate();
        renderPreflight();
        draw();
      });
      els.refresh?.addEventListener("click", () => {
        options.onRefreshCurrentJob?.();
      });
      window.addEventListener("resize", () => {
        if ((els.view?.value || "2d") === "3d") view3d?.resize?.();
        draw();
      });
    }

    function populateSpeeds() {
      if (!els.speed || els.speed.options.length) return;
      SPEEDS.forEach((value) => {
        const opt = document.createElement("option");
        opt.value = String(value);
        opt.textContent = `${value}×`;
        if (value === DEFAULT_SPEED) opt.selected = true;
        els.speed.appendChild(opt);
      });
    }

    function populateStandalonePlateTypes() {
      const select = $("simulator-plate-type");
      if (!select || select.options.length) return;
      (core()?.listPlateTypes?.() || []).forEach((plateType) => {
        const opt = document.createElement("option");
        opt.value = plateType.id;
        opt.textContent = plateType.label;
        select.appendChild(opt);
      });
      select.value = core()?.DEFAULT_PLATE_TYPE_ID || "24-well";
    }

    return {
      init(opts = {}) {
        options = opts;
        populateSpeeds();
        populateStandalonePlateTypes();
        bind();
        setPerspective("experiment");
        resolvePlate();
        ensureLoop();
        draw();
      },
      loadGcode(text, meta = {}) {
        parseAndLoad(text, meta.sourceLabel || "Current job");
      },
      setPlateType() {
        resolvePlate();
        draw();
      },
      getPastedGcode() {
        return String(els.text?.value || gcodeText || "");
      },
      pause() {
        playing = false;
      },
    };
  }

  const app = createSimulatorApp();
  root.GcodeMotionSimulator = app;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      if (document.body?.dataset?.simulatorStandalone === "true") app.init();
    });
  } else if (document.body?.dataset?.simulatorStandalone === "true") {
    app.init();
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
