(function settingsPanel(root) {
  const SETTINGS_STORAGE_KEY = "gcodeGenerator.settings.v1";
  const SETTINGS_PROFILES_STORAGE_KEY = "gcodeGenerator.settingsProfiles.v1";
  const ACTIVE_PROFILE_STORAGE_KEY = "gcodeGenerator.activeProfile.v1";
  const FACTORY_PROFILE_ID = "factory-defaults";

  const FACTORY_APP_SETTINGS = {
    annotate: true,
    minNeedleWidthMm: 0.3,
    allowSameInsertionPoint: true,
    removePauseDwells: false,
    defaultLowerZ: 1.5,
    defaultUpperZ: 1.51,
    defaultExtrusionE: 0.0105,
    zApproach: 4.71,
    zRetract: 4.31,
    zSafe: 6.21,
    zPark: 23,
    wellBottomZ: 2.35,
    feedXy: 350,
    feedApproach: 250,
    feedDescend: 30,
    feedExtrude: 3,
    feedRetract: 80,
    feedLift: 350,
    feedPark: 250,
    pauseStartMs: 100,
    pauseXyMs: 200,
    pauseApproachMs: 200,
    pauseLowerMs: 500,
    dwellDispenseSec: 1.5,
    pauseRetractMs: 750,
    pauseSafeMs: 200,
    pauseParkMs: 100,
  };

  const ui = {};
  let appSettings = { ...FACTORY_APP_SETTINGS };
  let onApplied = null;
  let currentDetailProfileId = null;
  let isDetailEditing = false;

  function $(id) {
    return document.getElementById(id);
  }

  function bindUi() {
    Object.assign(ui, {
      drawer: $("settings-drawer"),
      openBtn: $("settings-open"),
      closeBtn: $("settings-close"),
      backdrop: $("settings-drawer-backdrop"),
      doneBtn: $("settings-done"),
      resetBtn: $("settings-reset"),
      viewList: $("settings-view-list"),
      viewDetail: $("settings-view-detail"),
      profilesCount: $("settings-profiles-count"),
      createProfileBtn: $("settings-create-profile-btn"),
      newProfileInline: $("settings-new-profile-inline"),
      newProfileNameInput: $("settings-new-profile-name-input"),
      confirmCreateProfileBtn: $("settings-confirm-create-profile-btn"),
      cancelCreateProfileBtn: $("settings-cancel-create-profile-btn"),
      profilesCardsContainer: $("settings-profiles-cards-container"),
      backBtn: $("settings-back-btn"),
      detailCloseBtn: $("settings-detail-close"),
      detailProfileName: $("settings-detail-profile-name"),
      detailActiveBadge: $("settings-detail-active-badge"),
      detailModeNotice: $("settings-detail-mode-notice"),
      detailActionsReadonly: $("settings-detail-actions-readonly"),
      detailActionsEditing: $("settings-detail-actions-editing"),
      detailActivateBtn: $("settings-detail-activate-btn"),
      detailEditBtn: $("settings-detail-edit-btn"),
      detailSaveBtn: $("settings-detail-save-btn"),
      detailCancelBtn: $("settings-detail-cancel-btn"),
      detailEditNameSection: $("settings-detail-edit-name-section"),
      editNameInput: $("settings-edit-name-input"),
      detailFieldsWrapper: $("settings-detail-fields-wrapper"),
      annotate: $("settings-annotate"),
      mainAnnotate: $("annotate"),
      needleWidth: $("settings-needle-width"),
      allowSameInsertion: $("settings-allow-same-insertion"),
      removePauseDwells: $("settings-remove-pause-dwells"),
      defaultLowerZ: $("settings-default-lower-z"),
      defaultUpperZ: $("settings-default-upper-z"),
      defaultExtrusion: $("settings-default-extrusion"),
      zApproach: $("settings-z-approach"),
      zRetract: $("settings-z-retract"),
      zSafe: $("settings-z-safe"),
      zPark: $("settings-z-park"),
      plateBottomZ: $("settings-plate-bottom-z"),
      feedXy: $("settings-feed-xy"),
      feedApproach: $("settings-feed-approach"),
      feedDescend: $("settings-feed-descend"),
      feedExtrude: $("settings-feed-extrude"),
      feedRetract: $("settings-feed-retract"),
      feedLift: $("settings-feed-lift"),
      feedPark: $("settings-feed-park"),
      pauseStart: $("settings-pause-start"),
      pauseXy: $("settings-pause-xy"),
      pauseApproach: $("settings-pause-approach"),
      pauseLower: $("settings-pause-lower"),
      dwellDispense: $("settings-dwell-dispense"),
      pauseRetract: $("settings-pause-retract"),
      pauseSafe: $("settings-pause-safe"),
      pausePark: $("settings-pause-park"),
    });
  }

  function clamp(value, fallback, min = null) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    if (min != null && n < min) return min;
    return n;
  }

  function parseNum(value) {
    if (value == null || String(value).trim() === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function formatInput(value, decimals = 2) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "";
    return Number(n.toFixed(decimals)).toString();
  }

  function normalize(stored) {
    const src = stored && typeof stored === "object" ? stored : {};
    return {
      annotate: src.annotate == null ? FACTORY_APP_SETTINGS.annotate : Boolean(src.annotate),
      minNeedleWidthMm: clamp(src.minNeedleWidthMm, FACTORY_APP_SETTINGS.minNeedleWidthMm, 0),
      allowSameInsertionPoint: src.allowSameInsertionPoint == null
        ? FACTORY_APP_SETTINGS.allowSameInsertionPoint
        : Boolean(src.allowSameInsertionPoint),
      removePauseDwells: src.removePauseDwells == null
        ? FACTORY_APP_SETTINGS.removePauseDwells
        : Boolean(src.removePauseDwells),
      defaultLowerZ: clamp(src.defaultLowerZ, FACTORY_APP_SETTINGS.defaultLowerZ, 0),
      defaultUpperZ: clamp(src.defaultUpperZ, FACTORY_APP_SETTINGS.defaultUpperZ, 0),
      defaultExtrusionE: clamp(src.defaultExtrusionE, FACTORY_APP_SETTINGS.defaultExtrusionE, 0),
      zApproach: clamp(src.zApproach, FACTORY_APP_SETTINGS.zApproach, 0),
      zRetract: clamp(src.zRetract, FACTORY_APP_SETTINGS.zRetract, 0),
      zSafe: clamp(src.zSafe, FACTORY_APP_SETTINGS.zSafe, 0),
      zPark: clamp(src.zPark, FACTORY_APP_SETTINGS.zPark, 0),
      wellBottomZ: clamp(src.wellBottomZ, FACTORY_APP_SETTINGS.wellBottomZ, 0),
      feedXy: clamp(src.feedXy, FACTORY_APP_SETTINGS.feedXy, 0.01),
      feedApproach: clamp(src.feedApproach, FACTORY_APP_SETTINGS.feedApproach, 0.01),
      feedDescend: clamp(src.feedDescend, FACTORY_APP_SETTINGS.feedDescend, 0.01),
      feedExtrude: clamp(src.feedExtrude, FACTORY_APP_SETTINGS.feedExtrude, 0.01),
      feedRetract: clamp(src.feedRetract, FACTORY_APP_SETTINGS.feedRetract, 0.01),
      feedLift: clamp(src.feedLift, FACTORY_APP_SETTINGS.feedLift, 0.01),
      feedPark: clamp(src.feedPark, FACTORY_APP_SETTINGS.feedPark, 0.01),
      pauseStartMs: clamp(src.pauseStartMs, FACTORY_APP_SETTINGS.pauseStartMs, 0),
      pauseXyMs: clamp(src.pauseXyMs, FACTORY_APP_SETTINGS.pauseXyMs, 0),
      pauseApproachMs: clamp(src.pauseApproachMs, FACTORY_APP_SETTINGS.pauseApproachMs, 0),
      pauseLowerMs: clamp(src.pauseLowerMs, FACTORY_APP_SETTINGS.pauseLowerMs, 0),
      dwellDispenseSec: clamp(src.dwellDispenseSec, FACTORY_APP_SETTINGS.dwellDispenseSec, 0),
      pauseRetractMs: clamp(src.pauseRetractMs, FACTORY_APP_SETTINGS.pauseRetractMs, 0),
      pauseSafeMs: clamp(src.pauseSafeMs, FACTORY_APP_SETTINGS.pauseSafeMs, 0),
      pauseParkMs: clamp(src.pauseParkMs, FACTORY_APP_SETTINGS.pauseParkMs, 0),
    };
  }

  function loadStoredSettings() {
    try {
      return normalize(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || "{}"));
    } catch (_err) {
      return normalize({});
    }
  }

  function persistAppSettings() {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(appSettings));
    } catch (_err) {
      // Ignore quota / private-mode write failures.
    }
  }

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function loadSettingsProfiles() {
    let list = [];
    try {
      const parsed = JSON.parse(localStorage.getItem(SETTINGS_PROFILES_STORAGE_KEY) || "[]");
      if (Array.isArray(parsed)) list = parsed;
    } catch (_err) {
      list = [];
    }
    const customProfiles = list.filter((p) => p && p.id && p.id !== FACTORY_PROFILE_ID && p.name);
    return [
      { id: FACTORY_PROFILE_ID, name: "Factory Defaults", isFactory: true, settings: { ...FACTORY_APP_SETTINGS } },
      ...customProfiles.map((p) => ({ ...p, settings: normalize(p.settings) })),
    ];
  }

  function persistSettingsProfiles(profiles) {
    try {
      localStorage.setItem(
        SETTINGS_PROFILES_STORAGE_KEY,
        JSON.stringify(profiles.filter((p) => !p.isFactory))
      );
    } catch (_err) {
      // Ignore quota errors.
    }
  }

  function getActiveProfileId() {
    try {
      return localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY) || FACTORY_PROFILE_ID;
    } catch (_err) {
      return FACTORY_PROFILE_ID;
    }
  }

  function setActiveProfileId(id) {
    try {
      localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, id || FACTORY_PROFILE_ID);
    } catch (_err) {
      // Ignore storage failures.
    }
  }

  function notifyApplied() {
    if (typeof onApplied === "function") onApplied();
  }

  function syncMainAnnotate() {
    if (ui.mainAnnotate) ui.mainAnnotate.checked = Boolean(appSettings.annotate);
  }

  function applyLiveSettings(next) {
    appSettings = normalize(next);
    persistAppSettings();
    syncMainAnnotate();
    notifyApplied();
  }

  function pauseInputs() {
    return [
      ui.pauseStart, ui.pauseXy, ui.pauseApproach, ui.pauseLower,
      ui.pauseRetract, ui.pauseSafe, ui.pausePark,
    ];
  }

  function fillForm(settings) {
    const s = normalize(settings);
    if (ui.annotate) ui.annotate.checked = s.annotate;
    if (ui.needleWidth) ui.needleWidth.value = formatInput(s.minNeedleWidthMm);
    if (ui.allowSameInsertion) ui.allowSameInsertion.checked = s.allowSameInsertionPoint;
    if (ui.removePauseDwells) ui.removePauseDwells.checked = s.removePauseDwells;
    if (ui.defaultLowerZ) ui.defaultLowerZ.value = formatInput(s.defaultLowerZ);
    if (ui.defaultUpperZ) ui.defaultUpperZ.value = formatInput(s.defaultUpperZ);
    if (ui.defaultExtrusion) ui.defaultExtrusion.value = formatInput(s.defaultExtrusionE, 4);
    if (ui.zApproach) ui.zApproach.value = formatInput(s.zApproach);
    if (ui.zRetract) ui.zRetract.value = formatInput(s.zRetract);
    if (ui.zSafe) ui.zSafe.value = formatInput(s.zSafe);
    if (ui.zPark) ui.zPark.value = formatInput(s.zPark);
    if (ui.plateBottomZ) ui.plateBottomZ.value = formatInput(s.wellBottomZ);
    if (ui.feedXy) ui.feedXy.value = formatInput(s.feedXy);
    if (ui.feedApproach) ui.feedApproach.value = formatInput(s.feedApproach);
    if (ui.feedDescend) ui.feedDescend.value = formatInput(s.feedDescend);
    if (ui.feedExtrude) ui.feedExtrude.value = formatInput(s.feedExtrude);
    if (ui.feedRetract) ui.feedRetract.value = formatInput(s.feedRetract);
    if (ui.feedLift) ui.feedLift.value = formatInput(s.feedLift);
    if (ui.feedPark) ui.feedPark.value = formatInput(s.feedPark);
    if (ui.pauseStart) ui.pauseStart.value = formatInput(s.pauseStartMs);
    if (ui.pauseXy) ui.pauseXy.value = formatInput(s.pauseXyMs);
    if (ui.pauseApproach) ui.pauseApproach.value = formatInput(s.pauseApproachMs);
    if (ui.pauseLower) ui.pauseLower.value = formatInput(s.pauseLowerMs);
    if (ui.dwellDispense) ui.dwellDispense.value = formatInput(s.dwellDispenseSec, 4);
    if (ui.pauseRetract) ui.pauseRetract.value = formatInput(s.pauseRetractMs);
    if (ui.pauseSafe) ui.pauseSafe.value = formatInput(s.pauseSafeMs);
    if (ui.pausePark) ui.pausePark.value = formatInput(s.pauseParkMs);
    syncPauseInputLock();
  }

  function readForm(base) {
    const num = (input, fallback, min) => clamp(parseNum(input?.value), fallback, min);
    const current = normalize(base);
    return normalize({
      ...current,
      annotate: Boolean(ui.annotate?.checked),
      minNeedleWidthMm: num(ui.needleWidth, current.minNeedleWidthMm, 0),
      allowSameInsertionPoint: Boolean(ui.allowSameInsertion?.checked),
      removePauseDwells: Boolean(ui.removePauseDwells?.checked),
      defaultLowerZ: num(ui.defaultLowerZ, current.defaultLowerZ, 0),
      defaultUpperZ: num(ui.defaultUpperZ, current.defaultUpperZ, 0),
      defaultExtrusionE: num(ui.defaultExtrusion, current.defaultExtrusionE, 0),
      zApproach: num(ui.zApproach, current.zApproach, 0),
      zRetract: num(ui.zRetract, current.zRetract, 0),
      zSafe: num(ui.zSafe, current.zSafe, 0),
      zPark: num(ui.zPark, current.zPark, 0),
      wellBottomZ: num(ui.plateBottomZ, current.wellBottomZ, 0),
      feedXy: num(ui.feedXy, current.feedXy, 0.01),
      feedApproach: num(ui.feedApproach, current.feedApproach, 0.01),
      feedDescend: num(ui.feedDescend, current.feedDescend, 0.01),
      feedExtrude: num(ui.feedExtrude, current.feedExtrude, 0.01),
      feedRetract: num(ui.feedRetract, current.feedRetract, 0.01),
      feedLift: num(ui.feedLift, current.feedLift, 0.01),
      feedPark: num(ui.feedPark, current.feedPark, 0.01),
      pauseStartMs: num(ui.pauseStart, current.pauseStartMs, 0),
      pauseXyMs: num(ui.pauseXy, current.pauseXyMs, 0),
      pauseApproachMs: num(ui.pauseApproach, current.pauseApproachMs, 0),
      pauseLowerMs: num(ui.pauseLower, current.pauseLowerMs, 0),
      dwellDispenseSec: num(ui.dwellDispense, current.dwellDispenseSec, 0),
      pauseRetractMs: num(ui.pauseRetract, current.pauseRetractMs, 0),
      pauseSafeMs: num(ui.pauseSafe, current.pauseSafeMs, 0),
      pauseParkMs: num(ui.pausePark, current.pauseParkMs, 0),
    });
  }

  function syncPauseInputLock() {
    const locked = Boolean(ui.removePauseDwells?.checked);
    pauseInputs().forEach((input) => {
      if (!input) return;
      input.disabled = !isDetailEditing || locked;
    });
  }

  function setDetailEditMode(editing, isFactory) {
    isDetailEditing = Boolean(editing);
    if (ui.detailActionsReadonly) ui.detailActionsReadonly.hidden = isDetailEditing;
    if (ui.detailActionsEditing) ui.detailActionsEditing.hidden = !isDetailEditing;
    if (ui.detailEditNameSection) ui.detailEditNameSection.hidden = !isDetailEditing || isFactory;
    if (ui.detailFieldsWrapper) {
      ui.detailFieldsWrapper.classList.toggle("is-editing", isDetailEditing);
      ui.detailFieldsWrapper.classList.toggle("is-readonly", !isDetailEditing);
    }
    const inputs = ui.detailFieldsWrapper?.querySelectorAll("input, select") || [];
    inputs.forEach((input) => {
      input.disabled = !isDetailEditing;
    });
    syncPauseInputLock();
    if (ui.detailEditBtn) {
      ui.detailEditBtn.textContent = isFactory ? "Duplicate & Edit" : "Edit Profile";
    }
    if (ui.detailModeNotice) {
      if (isDetailEditing) {
        ui.detailModeNotice.textContent = "Editing profile. Adjust parameters and click Save Changes.";
      } else if (isFactory) {
        ui.detailModeNotice.textContent = "Factory Defaults are read-only. Duplicate them to make a custom profile.";
      } else {
        ui.detailModeNotice.textContent = "Viewing in read-only mode. Click Edit Profile to modify settings.";
      }
    }
  }

  function showProfilesListView() {
    currentDetailProfileId = null;
    isDetailEditing = false;
    if (ui.viewList) ui.viewList.hidden = false;
    if (ui.viewDetail) ui.viewDetail.hidden = true;
    if (ui.newProfileInline) ui.newProfileInline.hidden = true;
    renderProfilesList();
  }

  function renderProfilesList() {
    if (!ui.profilesCardsContainer) return;
    const profiles = loadSettingsProfiles();
    const activeId = getActiveProfileId();
    if (ui.profilesCount) {
      ui.profilesCount.textContent = `${profiles.length} ${profiles.length === 1 ? "Profile" : "Profiles"} Available`;
    }
    ui.profilesCardsContainer.innerHTML = "";
    profiles.forEach((profile) => {
      const isActive = profile.id === activeId;
      const card = document.createElement("div");
      card.className = `profile-card${isActive ? " is-active-card" : ""}`;
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", `Profile: ${profile.name}`);
      const settings = normalize(profile.settings);
      const pauseSummary = settings.removePauseDwells ? "Pauses: Removed" : "Pauses: Enabled";
      card.innerHTML = `
        <div class="profile-card-left">
          <div class="profile-card-title-row">
            <h3 class="profile-card-title">${escapeHtml(profile.name)}</h3>
            ${isActive ? '<span class="settings-badge-active">In Use</span>' : ""}
            ${profile.isFactory ? '<span class="settings-badge-factory">Factory</span>' : ""}
          </div>
          <div class="profile-card-chips">
            <span class="profile-chip">XY: ${escapeHtml(settings.feedXy)} mm/min</span>
            <span class="profile-chip">${escapeHtml(pauseSummary)}</span>
            <span class="profile-chip">Needle: ${escapeHtml(settings.minNeedleWidthMm)} mm</span>
            <span class="profile-chip">Park Z: ${escapeHtml(settings.zPark)} mm</span>
          </div>
        </div>
        <div class="profile-card-actions">
          ${isActive
            ? '<button type="button" class="btn-card-active-label" disabled>In Use</button>'
            : `<button type="button" class="btn-card-use" data-action="use" data-id="${escapeHtml(profile.id)}">Use Profile</button>`}
          <button type="button" class="btn-secondary" data-action="view" data-id="${escapeHtml(profile.id)}">Inspect / Edit</button>
          ${profile.isFactory
            ? ""
            : `<button type="button" class="btn-danger-outline" data-action="delete" data-id="${escapeHtml(profile.id)}">Delete</button>`}
        </div>
      `;
      card.addEventListener("click", (event) => {
        const button = event.target.closest("button");
        if (button) {
          const action = button.dataset.action;
          const id = button.dataset.id;
          if (action === "use") {
            event.stopPropagation();
            switchSettingsProfile(id);
            renderProfilesList();
            return;
          }
          if (action === "delete") {
            event.stopPropagation();
            deleteProfileById(id);
            return;
          }
          if (action === "view") {
            event.stopPropagation();
            showProfileDetail(id, false);
            return;
          }
        }
        showProfileDetail(profile.id, false);
      });
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          showProfileDetail(profile.id, false);
        }
      });
      ui.profilesCardsContainer.appendChild(card);
    });
  }

  function showProfileDetail(profileId, editMode) {
    const profiles = loadSettingsProfiles();
    const profile = profiles.find((item) => item.id === profileId) || profiles[0];
    currentDetailProfileId = profile.id;
    if (ui.viewList) ui.viewList.hidden = true;
    if (ui.viewDetail) ui.viewDetail.hidden = false;
    const isActive = profile.id === getActiveProfileId();
    if (ui.detailProfileName) ui.detailProfileName.textContent = profile.name;
    if (ui.detailActiveBadge) ui.detailActiveBadge.hidden = !isActive;
    if (ui.detailActivateBtn) ui.detailActivateBtn.hidden = isActive;
    if (ui.editNameInput) ui.editNameInput.value = profile.name;
    fillForm(profile.settings);
    setDetailEditMode(editMode, Boolean(profile.isFactory));
  }

  function switchSettingsProfile(profileId) {
    const profiles = loadSettingsProfiles();
    const found = profiles.find((item) => item.id === profileId) || profiles[0];
    setActiveProfileId(found.id);
    applyLiveSettings(found.settings);
    renderProfilesList();
  }

  function deleteProfileById(profileId) {
    if (profileId === FACTORY_PROFILE_ID) return;
    persistSettingsProfiles(loadSettingsProfiles().filter((item) => item.id !== profileId));
    if (getActiveProfileId() === profileId) {
      switchSettingsProfile(FACTORY_PROFILE_ID);
    }
    if (currentDetailProfileId === profileId) showProfilesListView();
    else renderProfilesList();
  }

  function saveDetailProfileChanges() {
    if (!currentDetailProfileId || currentDetailProfileId === FACTORY_PROFILE_ID) return;
    const profiles = loadSettingsProfiles();
    const index = profiles.findIndex((item) => item.id === currentDetailProfileId);
    if (index < 0 || profiles[index].isFactory) return;
    const updated = readForm(profiles[index].settings);
    const newName = (ui.editNameInput?.value || profiles[index].name).trim() || profiles[index].name;
    profiles[index] = { ...profiles[index], name: newName, settings: updated };
    persistSettingsProfiles(profiles);
    if (getActiveProfileId() === profiles[index].id) applyLiveSettings(updated);
    showProfileDetail(profiles[index].id, false);
  }

  function duplicateProfileAndEdit(profileId) {
    const profiles = loadSettingsProfiles();
    const source = profiles.find((item) => item.id === profileId) || profiles[0];
    const newId = `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const copy = {
      id: newId,
      name: source.isFactory ? "My Custom Profile" : `${source.name} (Copy)`,
      createdAt: Date.now(),
      settings: normalize(source.settings),
    };
    profiles.push(copy);
    persistSettingsProfiles(profiles);
    showProfileDetail(newId, true);
  }

  function createNewSettingsProfile(name) {
    const trimmed = (name || "").trim();
    if (!trimmed) return;
    const profiles = loadSettingsProfiles();
    const newId = `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const profile = {
      id: newId,
      name: trimmed,
      createdAt: Date.now(),
      settings: normalize(appSettings),
    };
    profiles.push(profile);
    persistSettingsProfiles(profiles);
    setActiveProfileId(newId);
    applyLiveSettings(profile.settings);
    showProfileDetail(newId, true);
  }

  function resetAppSettingsToFactory() {
    setActiveProfileId(FACTORY_PROFILE_ID);
    applyLiveSettings(FACTORY_APP_SETTINGS);
    showProfilesListView();
  }

  function isOpen() {
    return Boolean(ui.drawer && !ui.drawer.hidden);
  }

  function openSettings() {
    showProfilesListView();
    if (ui.drawer) ui.drawer.hidden = false;
    ui.openBtn?.setAttribute("aria-expanded", "true");
    ui.closeBtn?.focus();
  }

  function closeSettings() {
    if (!isOpen()) return;
    if (ui.drawer) ui.drawer.hidden = true;
    ui.openBtn?.setAttribute("aria-expanded", "false");
    isDetailEditing = false;
    ui.openBtn?.focus();
  }

  function bindEvents() {
    ui.openBtn?.addEventListener("click", openSettings);
    ui.closeBtn?.addEventListener("click", closeSettings);
    ui.detailCloseBtn?.addEventListener("click", closeSettings);
    ui.backdrop?.addEventListener("click", closeSettings);
    ui.doneBtn?.addEventListener("click", closeSettings);
    ui.resetBtn?.addEventListener("click", resetAppSettingsToFactory);
    ui.backBtn?.addEventListener("click", showProfilesListView);
    ui.createProfileBtn?.addEventListener("click", () => {
      if (!ui.newProfileInline) return;
      ui.newProfileInline.hidden = !ui.newProfileInline.hidden;
      if (!ui.newProfileInline.hidden) ui.newProfileNameInput?.focus();
    });
    ui.cancelCreateProfileBtn?.addEventListener("click", () => {
      if (ui.newProfileInline) ui.newProfileInline.hidden = true;
    });
    ui.confirmCreateProfileBtn?.addEventListener("click", () => {
      const name = ui.newProfileNameInput?.value;
      if (!name?.trim()) return;
      createNewSettingsProfile(name);
      if (ui.newProfileInline) ui.newProfileInline.hidden = true;
      if (ui.newProfileNameInput) ui.newProfileNameInput.value = "";
    });
    ui.newProfileNameInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        ui.confirmCreateProfileBtn?.click();
      } else if (event.key === "Escape") {
        if (ui.newProfileInline) ui.newProfileInline.hidden = true;
      }
    });
    ui.detailActivateBtn?.addEventListener("click", () => {
      if (!currentDetailProfileId) return;
      switchSettingsProfile(currentDetailProfileId);
      showProfileDetail(currentDetailProfileId, false);
    });
    ui.detailEditBtn?.addEventListener("click", () => {
      if (!currentDetailProfileId) return;
      const profile = loadSettingsProfiles().find((item) => item.id === currentDetailProfileId);
      if (profile?.isFactory) duplicateProfileAndEdit(currentDetailProfileId);
      else setDetailEditMode(true, false);
    });
    ui.detailSaveBtn?.addEventListener("click", saveDetailProfileChanges);
    ui.detailCancelBtn?.addEventListener("click", () => {
      if (currentDetailProfileId) showProfileDetail(currentDetailProfileId, false);
    });
    ui.removePauseDwells?.addEventListener("change", syncPauseInputLock);
    ui.mainAnnotate?.addEventListener("change", () => {
      appSettings.annotate = Boolean(ui.mainAnnotate.checked);
      persistAppSettings();
      const activeId = getActiveProfileId();
      if (activeId !== FACTORY_PROFILE_ID) {
        const profiles = loadSettingsProfiles();
        const index = profiles.findIndex((item) => item.id === activeId);
        if (index >= 0 && !profiles[index].isFactory) {
          profiles[index].settings = normalize({
            ...profiles[index].settings,
            annotate: appSettings.annotate,
          });
          persistSettingsProfiles(profiles);
        }
      }
      if (!isDetailEditing && currentDetailProfileId === activeId && ui.annotate) {
        ui.annotate.checked = appSettings.annotate;
      }
    });
  }

  function init(options = {}) {
    bindUi();
    onApplied = options.onApplied || null;
    appSettings = loadStoredSettings();
    const activeId = getActiveProfileId();
    const activeProfile = loadSettingsProfiles().find((item) => item.id === activeId);
    if (activeProfile && !activeProfile.isFactory) {
      appSettings = normalize(activeProfile.settings);
      persistAppSettings();
    } else if (!activeProfile) {
      setActiveProfileId(FACTORY_PROFILE_ID);
    }
    syncMainAnnotate();
    bindEvents();
    renderProfilesList();
  }

  root.AppSettings = {
    init,
    motion() {
      return { ...appSettings };
    },
    passDefaults() {
      return {
        lowerZ: appSettings.defaultLowerZ,
        upperZ: appSettings.defaultUpperZ,
        extrusionE: appSettings.defaultExtrusionE,
      };
    },
    isOpen,
    close: closeSettings,
  };
})(window);
