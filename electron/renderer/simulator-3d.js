(function (root) {
  const DEFAULT_AZIMUTH = Math.PI * 0.18;
  const DEFAULT_ELEVATION = 0.92;
  const WELL_LOOK_AT_Z = 3.5;
  const CAMERA_FOV_DEG = 42;
  const WELL_RIM_ARC_RAD = (120 * Math.PI) / 180;
  const PASS_COLORS = [0xf97316, 0x9333ea, 0x0891b2, 0xbe185d, 0x65a30d, 0x0d9488];

  function createOrbit(center, radius) {
    return {
      center: { x: center.x, y: center.y, z: center.z },
      radius,
      azimuth: DEFAULT_AZIMUTH,
      elevation: DEFAULT_ELEVATION,
    };
  }

  function orbitRadiusForFocus(focus) {
    const span = Math.max(Number(focus?.spanX) || 0, Number(focus?.spanY) || 0, 10);
    if (focus?.treatmentFocus) return Math.max(6, Number(focus.radius) || 7);
    const singleWell = (focus?.wellKeys || []).length === 1;
    if (singleWell) return Math.max(26, span * 1.65);
    if (Number(focus?.radius) > 0) return Math.max(14, focus.radius);
    return Math.max(14, span * 0.9);
  }

  function cameraFromOrbit(orbit) {
    const cosE = Math.cos(orbit.elevation);
    return {
      x: orbit.center.x + orbit.radius * cosE * Math.sin(orbit.azimuth),
      y: orbit.center.y - orbit.radius * cosE * Math.cos(orbit.azimuth),
      z: orbit.center.z + orbit.radius * Math.sin(orbit.elevation),
    };
  }

  function visualWellWallHeight(plate, hydrogelHeightMm) {
    const physicalDepthMm = Number(plate?.wellDepthMm);
    return Number.isFinite(physicalDepthMm) && physicalDepthMm > 0 ? physicalDepthMm : 15;
  }

  function makeArcPoints(THREE, radius, z, segments) {
    const half = WELL_RIM_ARC_RAD / 2;
    const start = Math.PI / 2 - half;
    const pts = [];
    for (let i = 0; i <= segments; i += 1) {
      const t = start + (i / segments) * WELL_RIM_ARC_RAD;
      pts.push(new THREE.Vector3(Math.cos(t) * radius, Math.sin(t) * radius, z));
    }
    return pts;
  }

  function makeWellRimGroup(THREE, radius, rimZ) {
    const group = new THREE.Group();
    group.userData.wellRim = true;
    const segs = 36;
    const half = WELL_RIM_ARC_RAD / 2;
    const start = Math.PI / 2 - half;
    const wallPos = [];
    const wallIdx = [];
    for (let i = 0; i <= segs; i += 1) {
      const t = start + (i / segs) * WELL_RIM_ARC_RAD;
      const x = Math.cos(t) * radius;
      const y = Math.sin(t) * radius;
      wallPos.push(x, y, 0, x, y, rimZ);
      if (i < segs) {
        const a = i * 2;
        wallIdx.push(a, a + 1, a + 3, a, a + 3, a + 2);
      }
    }
    const wallGeom = new THREE.BufferGeometry();
    wallGeom.setAttribute("position", new THREE.Float32BufferAttribute(wallPos, 3));
    wallGeom.setIndex(wallIdx);
    wallGeom.computeVertexNormals();
    const wall = new THREE.Mesh(
      wallGeom,
      new THREE.MeshBasicMaterial({
        color: 0xb45309,
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    wall.renderOrder = 3;
    group.add(wall);

    const rim = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(makeArcPoints(THREE, radius, rimZ, segs)),
      new THREE.LineBasicMaterial({ color: 0xb45309, toneMapped: false })
    );
    rim.renderOrder = 4;
    group.add(rim);

    const floorArc = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(makeArcPoints(THREE, radius, 0, segs)),
      new THREE.LineBasicMaterial({
        color: 0xd97706,
        toneMapped: false,
        transparent: true,
        opacity: 0.7,
      })
    );
    group.add(floorArc);

    const left = start;
    const right = start + WELL_RIM_ARC_RAD;
    const posts = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(Math.cos(left) * radius, Math.sin(left) * radius, 0),
        new THREE.Vector3(Math.cos(left) * radius, Math.sin(left) * radius, rimZ),
        new THREE.Vector3(Math.cos(right) * radius, Math.sin(right) * radius, 0),
        new THREE.Vector3(Math.cos(right) * radius, Math.sin(right) * radius, rimZ),
      ]),
      new THREE.LineBasicMaterial({ color: 0xb45309, toneMapped: false })
    );
    group.add(posts);
    return group;
  }

  function disposeObject(obj) {
    obj.geometry?.dispose?.();
    if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose?.());
    else obj.material?.dispose?.();
    (obj.children || []).slice().forEach((child) => {
      obj.remove(child);
      disposeObject(child);
    });
  }

  function bindOrbit(dom, orbit, onChange) {
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    dom.addEventListener("pointerdown", (event) => {
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      dom.setPointerCapture?.(event.pointerId);
    });
    dom.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      orbit.azimuth -= dx * 0.01;
      orbit.elevation = Math.max(0.08, Math.min(Math.PI / 2 - 0.05, orbit.elevation + dy * 0.01));
      onChange();
    });
    const stop = () => {
      dragging = false;
    };
    dom.addEventListener("pointerup", stop);
    dom.addEventListener("pointercancel", stop);
    dom.addEventListener("wheel", (event) => {
      event.preventDefault();
      orbit.radius = Math.max(8, Math.min(500, orbit.radius * (event.deltaY > 0 ? 1.08 : 0.92)));
      onChange();
    }, { passive: false });
  }

  function createView(container) {
    const THREE = root.THREE;
    if (!THREE || !container) return null;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc);
    const camera = new THREE.PerspectiveCamera(CAMERA_FOV_DEG, 1, 0.1, 2000);
    camera.up.set(0, 0, 1);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 0.85);
    key.position.set(40, -60, 80);
    scene.add(key);

    const plateGroup = new THREE.Group();
    scene.add(plateGroup);
    const hydrogelGroup = new THREE.Group();
    scene.add(hydrogelGroup);
    const pathMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      vertexColors: true,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.96,
      depthWrite: false,
      toneMapped: false,
    });
    const pathMesh = new THREE.Mesh(new THREE.BufferGeometry(), pathMat);
    pathMesh.renderOrder = 8;
    pathMesh.frustumCulled = false;
    scene.add(pathMesh);

    const pathLine = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: 0xffffff,
        vertexColors: true,
        toneMapped: false,
        depthWrite: false,
      })
    );
    pathLine.renderOrder = 9;
    pathLine.frustumCulled = false;
    scene.add(pathLine);

    const dispenseDots = new THREE.Points(
      new THREE.BufferGeometry(),
      new THREE.PointsMaterial({ color: 0xffffff, vertexColors: true, size: 0.32, sizeAttenuation: true })
    );
    dispenseDots.renderOrder = 10;
    scene.add(dispenseDots);
    const densityDots = new THREE.Points(
      new THREE.BufferGeometry(),
      new THREE.PointsMaterial({ color: 0xffffff, vertexColors: true, size: 1.15, sizeAttenuation: true, transparent: true, opacity: 0.62, depthWrite: false })
    );
    densityDots.renderOrder = 7;
    scene.add(densityDots);
    const sideTipMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 18, 14),
      new THREE.MeshBasicMaterial({ color: 0xf97316, depthTest: false })
    );
    sideTipMarker.visible = false;
    sideTipMarker.renderOrder = 20;
    scene.add(sideTipMarker);
    const sideCrosshair = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0xf97316, depthTest: false, toneMapped: false })
    );
    sideCrosshair.visible = false;
    sideCrosshair.renderOrder = 19;
    scene.add(sideCrosshair);
    const sectionPlane = new THREE.Mesh(
      new THREE.CircleGeometry(1, 64),
      new THREE.MeshBasicMaterial({ color: 0xec4899, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false })
    );
    sectionPlane.visible = false;
    sectionPlane.renderOrder = 6;
    scene.add(sectionPlane);

    const needle = new THREE.Group();
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xbfe8f5,
      transparent: true,
      opacity: 0.68,
      roughness: 0.18,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    const tipMat = new THREE.MeshStandardMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.86,
      roughness: 0.12,
      side: THREE.DoubleSide,
    });
    const shaftRadiusMm = 0.22;
    const tipRadiusMm = 0.05; // Pulled microcapillary tip: 0.1 mm diameter.
    const tipLengthMm = 2.4;
    const shaftLengthMm = 8;
    const tip = new THREE.Mesh(
      new THREE.CylinderGeometry(shaftRadiusMm, tipRadiusMm, tipLengthMm, 20, 1, false),
      tipMat
    );
    tip.rotation.x = Math.PI / 2;
    tip.position.z = tipLengthMm / 2;
    needle.add(tip);
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(shaftRadiusMm, shaftRadiusMm, shaftLengthMm, 20, 1, false),
      glassMat
    );
    shaft.rotation.x = Math.PI / 2;
    shaft.position.z = tipLengthMm + (shaftLengthMm / 2);
    needle.add(shaft);
    const dispenseMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.92 })
    );
    dispenseMarker.position.z = -0.08;
    dispenseMarker.visible = false;
    needle.add(dispenseMarker);
    scene.add(needle);

    const orbit = createOrbit({ x: 74.6, y: 39.5, z: WELL_LOOK_AT_Z }, 18);
    let cameraPreset = "depth";
    let currentHydrogelHeightMm = 0;
    const applyCamera = () => {
      const pos = cameraFromOrbit(orbit);
      camera.position.set(pos.x, pos.y, pos.z);
      camera.lookAt(orbit.center.x, orbit.center.y, orbit.center.z);
    };
    applyCamera();
    bindOrbit(renderer.domElement, orbit, applyCamera);

    function applyFollow(focus) {
      if (!focus?.center) return;
      const singleWell = (focus.wellKeys || []).length === 1;
      orbit.center.x = focus.center.x;
      orbit.center.y = focus.center.y;
      orbit.center.z = focus.treatmentFocus
        ? (focus.center.z == null ? WELL_LOOK_AT_Z : focus.center.z)
        : singleWell ? WELL_LOOK_AT_Z : (focus.center.z == null ? WELL_LOOK_AT_Z : focus.center.z);
      orbit.radius = orbitRadiusForFocus(focus);
      applyCamera();
    }

    function frameFocus(focus) {
      applyFollow(focus);
      applyCameraPreset();
      applyCamera();
    }

    function applyCameraPreset() {
      if (cameraPreset === "top") {
        orbit.azimuth = 0;
        orbit.elevation = 1.48;
        orbit.center.z = WELL_LOOK_AT_Z;
      } else if (cameraPreset === "side" || cameraPreset === "section") {
        orbit.azimuth = 0;
        orbit.elevation = 0.08;
        orbit.center.z = Math.max(1, currentHydrogelHeightMm / 2);
      } else if (cameraPreset === "oblique") {
        orbit.azimuth = DEFAULT_AZIMUTH;
        orbit.elevation = DEFAULT_ELEVATION;
        orbit.center.z = WELL_LOOK_AT_Z;
      } else {
        orbit.azimuth = Math.PI * 0.18;
        orbit.elevation = 0.42;
        orbit.center.z = Math.max(1, currentHydrogelHeightMm / 2);
      }
    }

    function setCameraPreset(preset) {
      cameraPreset = ["depth", "oblique", "side", "top", "section"].includes(preset) ? preset : "depth";
      applyCameraPreset();
      applyCamera();
    }

    function focusKey(focus) {
      if (!focus?.center) return "";
      const wells = (focus.wellKeys || []).join(",");
      return `${focus.treatmentFocus ? "treatment" : "well"}|${wells}|${focus.center.x.toFixed(2)}|${focus.center.y.toFixed(2)}|${Number(focus.radius).toFixed(1)}`;
    }

    function resize() {
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    }
    const resizeObserver = typeof ResizeObserver === "function"
      ? new ResizeObserver(() => {
        resize();
        applyCamera();
      })
      : null;
    resizeObserver?.observe(container);

    function rebuildPlate(plate, wallHeightMm) {
      while (plateGroup.children.length) {
        const child = plateGroup.children[0];
        plateGroup.remove(child);
        disposeObject(child);
      }
      if (!plate) return;
      const bounds = root.GcodeSimulator2D.plateBounds(plate);
      const w = bounds.maxX - bounds.minX;
      const d = bounds.maxY - bounds.minY;
      const cx = (bounds.minX + bounds.maxX) / 2;
      const cy = (bounds.minY + bounds.maxY) / 2;
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(w, d, 1.2),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.9 })
      );
      slab.position.set(cx, cy, -0.6);
      slab.userData.plateSlab = true;
      plateGroup.add(slab);

      const wellFloorMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const rimZ = wallHeightMm;
      Object.entries(plate.wellCenters || {}).forEach(([key, [wx, wy]]) => {
        const r = plate.wellRadiusMm || plate.wellDiamMm / 2;
        const floor = new THREE.Mesh(new THREE.CircleGeometry(r, 48), wellFloorMat);
        floor.position.set(wx, wy, -0.04);
        floor.userData.wellKey = key;
        plateGroup.add(floor);
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(r, 0.16, 8, 48),
          new THREE.MeshBasicMaterial({ color: 0x94a3b8 })
        );
        // This ring is the physical top rim, not the well bottom.
        ring.position.set(wx, wy, rimZ);
        ring.userData.wellKey = key;
        plateGroup.add(ring);
        const rim = makeWellRimGroup(THREE, r, rimZ);
        rim.position.set(wx, wy, 0);
        rim.userData.wellKey = key;
        plateGroup.add(rim);
      });
    }

    function orientWellRims() {
      const cam = camera.position;
      plateGroup.children.forEach((child) => {
        if (!child.userData?.wellRim) return;
        const back = Math.atan2(child.position.y - cam.y, child.position.x - cam.x);
        child.rotation.z = back - Math.PI / 2;
      });
    }

    function highlightWells(focus) {
      const active = new Set(focus?.wellKeys || []);
      plateGroup.children.forEach((child) => {
        if (child.userData?.plateSlab) {
          child.visible = active.size === 0;
          return;
        }
        if (child.userData.wellRim) {
          child.visible = !active.size || active.has(child.userData.wellKey);
          return;
        }
        if (!child.userData.wellKey) return;
        child.visible = !active.size || active.has(child.userData.wellKey);
        if (child.material?.color) {
          child.material.color.set(active.has(child.userData.wellKey) ? 0xdc2626 : 0x94a3b8);
        }
      });
    }

    let lastPlateId = null;
    let lastFocusKey = null;
    let lastHydrogelKey = null;

    function rebuildHydrogel(plate, focus, heightMm, hydrogelWellKeys) {
      const requestedWells = focus?.fullPlate ? (hydrogelWellKeys || []) : (focus?.wellKeys || []);
      const activeWells = requestedWells.filter((key) => plate?.wellCenters?.[key]);
      const safeHeight = Math.max(0, Number(heightMm) || 0);
      const key = `${plate?.plateTypeId || ""}|${activeWells.join(",")}|${safeHeight.toFixed(3)}`;
      if (key === lastHydrogelKey) return;
      lastHydrogelKey = key;
      while (hydrogelGroup.children.length) {
        const child = hydrogelGroup.children[0];
        hydrogelGroup.remove(child);
        disposeObject(child);
      }
      if (!plate || !activeWells.length || safeHeight <= 0) return;
      const radius = Math.max(0.05, (plate.wellRadiusMm || plate.wellDiamMm / 2) - 0.22);
      activeWells.forEach((wellKey) => {
        const [x, y] = plate.wellCenters[wellKey];
        const hydrogel = new THREE.Mesh(
          new THREE.CylinderGeometry(radius, radius, safeHeight, 48, 1, false),
          new THREE.MeshStandardMaterial({
            color: 0xf472b6,
            transparent: true,
            opacity: 0.24,
            roughness: 0.3,
            side: THREE.DoubleSide,
            depthWrite: false,
          })
        );
        hydrogel.rotation.x = Math.PI / 2;
        hydrogel.position.set(x, y, safeHeight / 2);
        hydrogel.renderOrder = 5;
        hydrogelGroup.add(hydrogel);

        // Give the liquid-air boundary its own slightly darker surface so the
        // calculated fill height remains easy to read through the translucent
        // hydrogel body.
        const hydrogelTop = new THREE.Mesh(
          new THREE.CircleGeometry(radius, 48),
          new THREE.MeshBasicMaterial({
            color: 0xdb5f9c,
            transparent: true,
            opacity: 0.31,
            side: THREE.DoubleSide,
            depthWrite: false,
          })
        );
        hydrogelTop.position.set(x, y, safeHeight + 0.006);
        hydrogelTop.renderOrder = 6;
        hydrogelGroup.add(hydrogelTop);
      });
    }

    function render(state) {
      resize();
      currentHydrogelHeightMm = Math.max(0, Number(state.hydrogelHeightMm) || 0);
      const plate = state.plate;
      const wallHeightMm = visualWellWallHeight(plate, state.hydrogelHeightMm);
      const plateId = plate ? `${plate.plateTypeId}-${plate.wellKeys?.length}-${wallHeightMm.toFixed(3)}` : "";
      if (plateId !== lastPlateId) {
        lastPlateId = plateId;
        lastFocusKey = null;
        rebuildPlate(plate, wallHeightMm);
      }
      const nextFocusKey = focusKey(state.focus);
      if (state.cameraFollow && state.focus?.center) {
        applyFollow(state.focus);
        lastFocusKey = nextFocusKey;
      } else if (nextFocusKey && nextFocusKey !== lastFocusKey) {
        lastFocusKey = nextFocusKey;
        frameFocus(state.focus);
      }
      highlightWells(state.focus);
      orientWellRims();
      rebuildHydrogel(plate, state.focus, state.hydrogelHeightMm, state.hydrogelWellKeys);

      const trail = state.showCompletedMoves === false ? [] : (state.trail || []);
      const rgbAt = (z) => {
        const hex = root.GcodeCore?.colorForZSpan
          ? root.GcodeCore.colorForZSpan(z, state.zBounds?.minZ, state.zBounds?.maxZ)
          : null;
        if (hex && THREE.Color) {
          const c = new THREE.Color(hex);
          return [c.r, c.g, c.b];
        }
        if (root.GcodeCore?.rgb01ForZSpan) {
          return root.GcodeCore.rgb01ForZSpan(z, state.zBounds?.minZ, state.zBounds?.maxZ);
        }
        return [0.86, 0.15, 0.15];
      };
      const linePts = [];
      const lineColors = [];
      const ribbonPts = [];
      const ribbonColors = [];
      const up = new THREE.Vector3(0, 0, 1);
      const halfW = 0.042;
      for (let i = 1; i < trail.length; i += 1) {
        const prev = trail[i - 1];
        const cur = trail[i];
        if (prev.x == null || cur.x == null) continue;
        const kind = cur.displayKind || cur.kind;
        if (kind === "dwell") continue;
        if (kind === "travel" && state.showTravelMoves === false) continue;
        if (kind === "zMove" && state.showZMoves === false) continue;
        // The program can establish X/Y before its first Z command. Do not
        // invent Z=0 for that unknown machine position; it creates a false
        // first-injection stroke that is not present in the G-code.
        if (prev.z == null || cur.z == null) continue;
        const a = new THREE.Vector3(prev.x, prev.y, prev.z);
        const b = new THREE.Vector3(cur.x, cur.y, cur.z);
        linePts.push(a, b);
        const c0 = rgbAt(prev.z);
        const c1 = rgbAt(cur.z);
        lineColors.push(c0[0], c0[1], c0[2], c1[0], c1[1], c1[2]);
        const dir = b.clone().sub(a);
        if (dir.lengthSq() < 1e-12) continue;
        let side = new THREE.Vector3().crossVectors(dir, up);
        if (side.lengthSq() < 1e-12) side.set(1, 0, 0);
        else side.normalize();
        side.multiplyScalar(halfW);
        const a1 = a.clone().add(side);
        const a2 = a.clone().sub(side);
        const b1 = b.clone().add(side);
        const b2 = b.clone().sub(side);
        const tri = [a1, a2, b2, a1, b2, b1];
        const cols = [c0, c0, c1, c0, c1, c1];
        tri.forEach((p, idx) => {
          ribbonPts.push(p.x, p.y, p.z);
          ribbonColors.push(cols[idx][0], cols[idx][1], cols[idx][2]);
        });
      }
      pathLine.geometry.dispose();
      const lineGeom = new THREE.BufferGeometry().setFromPoints(linePts);
      if (lineColors.length) {
        lineGeom.setAttribute("color", new THREE.Float32BufferAttribute(lineColors, 3));
      }
      pathLine.geometry = lineGeom;

      pathMesh.geometry.dispose();
      const ribbonGeom = new THREE.BufferGeometry();
      if (ribbonPts.length) {
        ribbonGeom.setAttribute("position", new THREE.Float32BufferAttribute(ribbonPts, 3));
        ribbonGeom.setAttribute("color", new THREE.Float32BufferAttribute(ribbonColors, 3));
      }
      pathMesh.geometry = ribbonGeom;
      pathMesh.visible = ribbonPts.length > 0 && !state.sideProjection;
      pathLine.visible = !state.sideProjection;

      const visibleDispenses = (state.dispensePoints || [])
        .filter((point) => point.x != null && point.y != null)
        .filter((point) => {
          if (!state.sectionMode) return true;
          const z0 = Number.isFinite(point.zStart) ? point.zStart : Number(point.z) || 0;
          const z1 = Number.isFinite(point.zEnd) ? point.zEnd : Number(point.z) || 0;
          const lo = Math.min(z0, z1) - 0.15;
          const hi = Math.max(z0, z1) + 0.15;
          return state.sectionHeightMm >= lo && state.sectionHeightMm <= hi;
        });
      dispenseDots.geometry.dispose();
      const dispenseGeometry = new THREE.BufferGeometry().setFromPoints(
        visibleDispenses.map((point) => new THREE.Vector3(point.x, point.y, point.z || 0))
      );
      const passColors = [];
      visibleDispenses.forEach((point) => {
        const color = new THREE.Color(PASS_COLORS[(Math.max(1, Number(point.passNum) || 1) - 1) % PASS_COLORS.length]);
        passColors.push(color.r, color.g, color.b);
      });
      if (passColors.length) dispenseGeometry.setAttribute("color", new THREE.Float32BufferAttribute(passColors, 3));
      dispenseDots.geometry = dispenseGeometry;
      dispenseDots.material.size = state.sideProjection ? 0.48 : 0.32;
      densityDots.geometry.dispose();
      const densityGeometry = new THREE.BufferGeometry().setFromPoints(
        visibleDispenses.map((point) => new THREE.Vector3(point.x, point.y, point.z || 0))
      );
      const maxDensity = Math.max(1e-12, ...visibleDispenses.map((point) => Number(point.densityValue) || 0));
      const densityColors = [];
      visibleDispenses.forEach((point) => {
        const u = Math.max(0, Math.min(1, (Number(point.densityValue) || 0) / maxDensity));
        densityColors.push(0.98 - u * 0.13, 0.72 - u * 0.62, 0.84 - u * 0.38);
      });
      if (densityColors.length) densityGeometry.setAttribute("color", new THREE.Float32BufferAttribute(densityColors, 3));
      densityDots.geometry = densityGeometry;
      densityDots.visible = Boolean(state.showDensity);
      const sectionWell = state.focus?.wellKeys?.[0];
      const sectionCenter = sectionWell ? plate?.wellCenters?.[sectionWell] : null;
      sectionPlane.visible = Boolean(state.sectionMode && sectionCenter);
      if (sectionCenter) {
        const radius = Math.max(0.1, (plate.wellRadiusMm || plate.wellDiamMm / 2) - 0.25);
        sectionPlane.scale.set(radius, radius, 1);
        sectionPlane.position.set(sectionCenter[0], sectionCenter[1], state.sectionHeightMm);
      }

      const sample = state.sample;
      if (sample && sample.x != null && sample.y != null) {
        const activePassColor = PASS_COLORS[(Math.max(1, Number(sample.passNum) || 1) - 1) % PASS_COLORS.length];
        dispenseMarker.material.color.set(activePassColor);
        sideTipMarker.material.color.set(activePassColor);
        // Side projection is a coordinate inspection view. A full capillary
        // shaft looks like a false vertical path here, so show only its exact
        // X/Z tip marker.
        needle.visible = !state.sideProjection;
        needle.position.set(sample.x, sample.y, sample.z || 0);
        dispenseMarker.visible = !state.sideProjection && sample.displayKind === "dispense";
        sideTipMarker.visible = Boolean(state.sideProjection && Number.isFinite(sample.z));
        sideCrosshair.visible = false;
        if (sideTipMarker.visible) {
          const z = sample.z;
          sideTipMarker.position.set(sample.x, sample.y - 0.02, z);
        }
      } else {
        needle.visible = false;
        dispenseMarker.visible = false;
        sideTipMarker.visible = false;
        sideCrosshair.visible = false;
      }
      renderer.render(scene, camera);
    }

    function dispose() {
      resizeObserver?.disconnect();
      renderer.dispose();
      container.innerHTML = "";
    }

    return { render, dispose, resize, setCameraPreset };
  }

  root.GcodeSimulator3D = { createView };
})(typeof globalThis !== "undefined" ? globalThis : this);
