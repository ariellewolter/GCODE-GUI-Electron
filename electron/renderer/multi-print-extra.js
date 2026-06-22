/**
 * Dynamic extra print passes (Print 2, 3, …) for multi-print mode.
 */
(function initExtraPrintUI(global) {
  const MAX_EXTRA_PASSES = 9;

  let passNumbers = [2];
  let passCustomized = new Set();
  let containerEl = null;
  let callbacks = {};

  function fieldTarget(printNum) {
    const card = document.getElementById(`extra-print-${printNum}`);
    if (!card) return null;
    const q = (sel) => card.querySelector(sel);
    return {
      startX: q(`#p${printNum}-start-x`),
      startY: q(`#p${printNum}-start-y`),
      dots: q(`#p${printNum}-dots`),
      perRow: q(`#p${printNum}-per-row`),
      rows: q(`#p${printNum}-rows`),
      spacingX: q(`#p${printNum}-spacing-x`),
      spacingY: q(`#p${printNum}-spacing-y`),
      lowerZ: q(`#p${printNum}-lower-z`),
      upperZ: q(`#p${printNum}-upper-z`),
      extrusionE: q(`#p${printNum}-extrusion-e`),
      angleOffset: q(`#p${printNum}-angle-offset`),
      offsetMin: q(`#p${printNum}-offset-min`),
      offsetMax: q(`#p${printNum}-offset-max`),
      offsetSide: q(`#p${printNum}-offset-side`),
    };
  }

  function getMode(printNum) {
    const card = document.getElementById(`extra-print-${printNum}`);
    if (!card) return "same";
    const selected = card.querySelector(`input[name="print-${printNum}-mode"]:checked`);
    return selected ? selected.value : "same";
  }

  function isOffsetEnabled(printNum) {
    const t = fieldTarget(printNum);
    return Boolean(t?.angleOffset?.checked);
  }

  function buildCardMarkup(printNum) {
    const passLegend = printNum === 2 ? "Second pass G-code" : `Pass ${printNum} G-code`;
    const passNote =
      printNum === 2
        ? "Second pass in the <strong>same well</strong> as Print 1."
        : `Pass ${printNum} in the <strong>same well</strong> as Print 1.`;
    return `
      <div class="extra-print-card" id="extra-print-${printNum}" data-print-num="${printNum}">
        <div class="extra-print-card-header">
          <h2>Print ${printNum}</h2>
          <button type="button" class="extra-print-remove ws-choice-secondary" data-remove-print="${printNum}" aria-label="Remove Print ${printNum}"${passNumbers.length <= 1 ? " hidden" : ""}>Remove</button>
        </div>
        <p class="note extra-print-note">${passNote}</p>
        <div class="print-2-options">
          <fieldset class="print-2-mode-fieldset" data-mode-fieldset="${printNum}">
            <legend>${passLegend}</legend>
            <label class="radio">
              <input type="radio" name="print-${printNum}-mode" value="same" checked />
              <span>Same pattern as Print 1</span>
            </label>
            <label class="radio">
              <input type="radio" name="print-${printNum}-mode" value="different" />
              <span>Different pattern in same well</span>
            </label>
          </fieldset>
          <div class="print-2-angle-options">
            <label class="checkbox">
              <input type="checkbox" id="p${printNum}-angle-offset" />
              <span>Offset pass ${printNum} along Y only (X matches Print 1)</span>
            </label>
            <p class="note p2-offset-uses-print1-note" id="p${printNum}-offset-print1-note" hidden>
              Pass ${printNum} uses Print 1 Start X/Y, dots, and spacing above. Only the Y offset below applies to pass ${printNum}.
            </p>
            <div class="print-2-angle-controls" id="p${printNum}-angle-controls" hidden>
              <p class="note">
                X stays on Print 1. Y offset steps across each row from the first column to the last.
                Example (10 per row): dots 1, 11, 21 → +0.1 mm Y; dots 10, 20, 30 → +1.0 mm Y.
                Use a larger first-column value than last to reverse the ramp.
              </p>
              <label>First column Y offset (mm)</label>
              <input id="p${printNum}-offset-min" type="number" step="0.01" value="0.1" />
              <label>Last column Y offset (mm)</label>
              <input id="p${printNum}-offset-max" type="number" step="0.01" value="1" />
              <label>Y offset direction</label>
              <select id="p${printNum}-offset-side">
                <option value="positive">+Y</option>
                <option value="negative">−Y</option>
              </select>
            </div>
          </div>
          <div class="print-2-pass-fields">
            <h3 class="print-2-pass-heading">Print ${printNum} pass settings</h3>
            <p class="note print-2-pass-note">
              Lower Z, Upper Z, and E default to Print 1 values. Change here to apply only to pass ${printNum}.
            </p>
            <label>Lower Z Offset (mm above bottom)</label>
            <input id="p${printNum}-lower-z" type="number" step="0.01" />
            <label>Upper Z Offset (mm above bottom)</label>
            <input id="p${printNum}-upper-z" type="number" step="0.01" />
            <label>Extrusion per dot (E)</label>
            <input id="p${printNum}-extrusion-e" type="number" step="0.0001" />
            <button type="button" class="extra-sync-pass" data-sync-pass="${printNum}">Use Print 1 Z and E</button>
          </div>
          <div class="print-2-controls" id="p${printNum}-pattern-wrap" hidden>
            <div class="print-2-pattern-fields">
              <h3 class="print-2-pattern-heading">Print ${printNum} pattern</h3>
              <p class="note print-2-pattern-note">
                Separate Start X/Y, dots, and spacing for pass ${printNum}.
              </p>
              <label for="p${printNum}-stored-starts">Stored well starts</label>
              <select id="p${printNum}-stored-starts" class="stored-well-starts-select" aria-label="Stored well starts for selected plate">
                <option value="">Select stored start…</option>
              </select>
              <label>Start X (mm)</label>
              <input id="p${printNum}-start-x" type="number" step="0.01" />
              <label>Start Y (mm)</label>
              <input id="p${printNum}-start-y" type="number" step="0.01" />
              <label>Number of Dots</label>
              <input id="p${printNum}-dots" type="number" readonly tabindex="-1" aria-readonly="true" title="Auto-calculated: Dots Per Row × Number of Rows" />
              <label>Dots Per Row</label>
              <input id="p${printNum}-per-row" type="number" />
              <label>Number of Rows</label>
              <input id="p${printNum}-rows" type="number" />
              <label>Dot Spacing X (mm)</label>
              <input id="p${printNum}-spacing-x" type="number" step="0.01" />
              <label>Dot Spacing Y (mm)</label>
              <input id="p${printNum}-spacing-y" type="number" step="0.01" />
              <button type="button" class="extra-snap-pass" data-snap-pass="${printNum}">Snap to well center</button>
            </div>
          </div>
        </div>
        <button type="button" class="extra-save-pass" data-save-pass="${printNum}">Save Print ${printNum}</button>
      </div>`;
  }

  function updateCardVisibility(printNum) {
    const card = document.getElementById(`extra-print-${printNum}`);
    if (!card) return;
    const offsetOn = isOffsetEnabled(printNum);
    const different = getMode(printNum) === "different";
    const modeFs = card.querySelector(`[data-mode-fieldset="${printNum}"]`);
    const angleControls = card.querySelector(`#p${printNum}-angle-controls`);
    const offsetNote = card.querySelector(`#p${printNum}-offset-print1-note`);
    const patternWrap = card.querySelector(`#p${printNum}-pattern-wrap`);
    if (modeFs) {
      modeFs.disabled = offsetOn;
      modeFs.classList.toggle("disabled", offsetOn);
    }
    if (angleControls) angleControls.hidden = !offsetOn;
    if (offsetNote) offsetNote.hidden = !offsetOn;
    if (patternWrap) patternWrap.hidden = !different || offsetOn;
  }

  function bindCard(printNum) {
    const card = document.getElementById(`extra-print-${printNum}`);
    if (!card) return;

    card.querySelectorAll(`input[name="print-${printNum}-mode"]`).forEach((input) => {
      input.addEventListener("change", () => {
        updateCardVisibility(printNum);
        if (getMode(printNum) === "different") {
          callbacks.onDifferentMode?.(printNum);
        }
        callbacks.onChange?.();
      });
    });

    const offsetCb = card.querySelector(`#p${printNum}-angle-offset`);
    offsetCb?.addEventListener("change", () => {
      updateCardVisibility(printNum);
      callbacks.onOffsetToggle?.(printNum);
    });

    [card.querySelector(`#p${printNum}-offset-min`), card.querySelector(`#p${printNum}-offset-max`)].forEach(
      (inp) => inp?.addEventListener("input", () => callbacks.onChange?.())
    );
    card.querySelector(`#p${printNum}-offset-side`)?.addEventListener("change", () => callbacks.onChange?.());

    card.querySelector(`[data-sync-pass="${printNum}"]`)?.addEventListener("click", () => {
      callbacks.onSyncPass?.(printNum);
    });
    card.querySelector(`[data-snap-pass="${printNum}"]`)?.addEventListener("click", () => {
      callbacks.onSnap?.(printNum);
    });
    card.querySelector(`[data-save-pass="${printNum}"]`)?.addEventListener("click", () => {
      callbacks.onSavePass?.(printNum);
    });
    card.querySelector(`[data-remove-print="${printNum}"]`)?.addEventListener("click", () => {
      callbacks.onRemove?.(printNum);
    });

    const passInputs = [
      `#p${printNum}-lower-z`,
      `#p${printNum}-upper-z`,
      `#p${printNum}-extrusion-e`,
    ];
    passInputs.forEach((sel) => {
      card.querySelector(sel)?.addEventListener("input", () => {
        passCustomized.add(printNum);
        callbacks.onChange?.();
      });
    });

    [card.querySelector(`#p${printNum}-per-row`), card.querySelector(`#p${printNum}-rows`)].forEach((inp) => {
      inp?.addEventListener("input", () => callbacks.onGridLayout?.(printNum));
    });
    [
      card.querySelector(`#p${printNum}-spacing-x`),
      card.querySelector(`#p${printNum}-spacing-y`),
      card.querySelector(`#p${printNum}-start-x`),
      card.querySelector(`#p${printNum}-start-y`),
    ].forEach((inp) => inp?.addEventListener("input", () => callbacks.onChange?.()));

    updateCardVisibility(printNum);
    callbacks.onCardBound?.(printNum);
  }

  function renderAllCards() {
    if (!containerEl) return;
    containerEl.innerHTML = "";
    passNumbers.forEach((n) => {
      containerEl.insertAdjacentHTML("beforeend", buildCardMarkup(n));
      bindCard(n);
    });
  }

  function syncPreviewTargetOptions(selectEl) {
    if (!selectEl) return;
    const prev = selectEl.value;
    selectEl.innerHTML = "";
    const both = document.createElement("option");
    both.value = "both";
    both.textContent = "All passes";
    selectEl.appendChild(both);
    const p1 = document.createElement("option");
    p1.value = "1";
    p1.textContent = "Print 1";
    selectEl.appendChild(p1);
    passNumbers.forEach((n) => {
      const opt = document.createElement("option");
      opt.value = String(n);
      opt.textContent = `Print ${n}`;
      selectEl.appendChild(opt);
    });
    if ([...selectEl.options].some((o) => o.value === prev)) {
      selectEl.value = prev;
    } else {
      selectEl.value = "both";
    }
  }

  function addPass() {
    if (passNumbers.length >= MAX_EXTRA_PASSES) return null;
    const next = Math.max(...passNumbers, 1) + 1;
    passNumbers.push(next);
    if (containerEl) {
      containerEl.insertAdjacentHTML("beforeend", buildCardMarkup(next));
      bindCard(next);
      passNumbers.forEach((n) => {
        const card = document.getElementById(`extra-print-${n}`);
        const removeBtn = card?.querySelector("[data-remove-print]");
        if (removeBtn) removeBtn.hidden = passNumbers.length <= 1;
      });
    }
    return next;
  }

  function removePass(printNum) {
    if (passNumbers.length <= 1) return false;
    passNumbers = passNumbers.filter((n) => n !== printNum);
    passCustomized.delete(printNum);
    document.getElementById(`extra-print-${printNum}`)?.remove();
    passNumbers.forEach((n) => {
      const card = document.getElementById(`extra-print-${n}`);
      const removeBtn = card?.querySelector("[data-remove-print]");
      if (removeBtn) removeBtn.hidden = passNumbers.length <= 1;
    });
    return true;
  }

  function setMode(printNum, mode) {
    const card = document.getElementById(`extra-print-${printNum}`);
    const radio = card?.querySelector(`input[name="print-${printNum}-mode"][value="${mode}"]`);
    if (radio) radio.checked = true;
    updateCardVisibility(printNum);
  }

  function resetModeToSame(printNum) {
    setMode(printNum, "same");
  }

  function resetPasses() {
    passNumbers = [2];
    passCustomized = new Set();
    renderAllCards();
  }

  global.ExtraPrintUI = {
    MAX_EXTRA_PASSES,
    init(container, cbs) {
      containerEl = container;
      callbacks = cbs || {};
      renderAllCards();
    },
    getPassList: () => [...passNumbers],
    fieldTarget,
    getMode,
    isOffsetEnabled,
    addPass,
    removePass,
    resetPasses,
    resetModeToSame,
    setMode,
    isPassCustomized: (n) => passCustomized.has(n),
    setPassCustomized: (n) => passCustomized.add(n),
    clearPassCustomized: (n) => passCustomized.delete(n),
    clearAllPassCustomized: () => passCustomized.clear(),
    syncPreviewTargetOptions,
    updateCardVisibility,
    updateAllCardVisibility() {
      passNumbers.forEach((n) => updateCardVisibility(n));
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
