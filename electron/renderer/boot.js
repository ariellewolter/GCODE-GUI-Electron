function showBootFailure(message, detail) {
  const panel = document.createElement("div");
  panel.id = "startup-error";
  panel.style.cssText =
    "margin:16px;padding:16px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;color:#991b1b;font:14px/1.5 -apple-system,BlinkMacSystemFont,sans-serif;";
  const detailHtml = detail
    ? `<pre style="margin:8px 0 0;white-space:pre-wrap;font-size:12px;opacity:0.9">${detail}</pre>`
    : "";
  panel.innerHTML = `<strong>App failed to start.</strong><p style="margin:8px 0 0">${message}</p>${detailHtml}`;
  document.body.prepend(panel);
}

function coreIsReady() {
  const core = window.GcodeCore;
  return core && typeof core.computeGridLayout === "function";
}

function loadRendererScript() {
  const script = document.createElement("script");
  script.src = "./renderer.js";
  script.onerror = () => {
    showBootFailure("Could not load the application UI (renderer.js).");
  };
  script.onload = () => {
    if (!window.gcodeApi?.saveGcode) {
      showBootFailure(
        "Save/export is unavailable in this window.",
        "Launch the desktop app:\n  npm run electron\n—or open G-Code Generator.app from Releases.\n\nDo not open index.html in a browser."
      );
    }
  };
  document.body.appendChild(script);
}

function coreScriptCandidates() {
  const urls = [];
  const add = (href) => {
    if (href && !urls.includes(href)) urls.push(href);
  };

  add("./gcode-core.js");
  try {
    add(new URL("./gcode-core.js", window.location.href).href);
    add(new URL("../shared/gcode-core.js", window.location.href).href);
  } catch (_err) {
    // ignore URL resolution errors
  }
  if (window.gcodeCoreScriptSrc) add(window.gcodeCoreScriptSrc);

  return urls;
}

function loadCoreScript(onReady, onError) {
  const candidates = coreScriptCandidates();
  if (!candidates.length) {
    onError("No gcode-core.js path available.");
    return;
  }

  let index = 0;

  function tryNext() {
    if (index >= candidates.length) {
      onError(
        `Failed to load gcode-core.js (tried ${candidates.length} path(s)).`
      );
      return;
    }

    const src = candidates[index];
    index += 1;
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => {
      if (coreIsReady()) onReady();
      else tryNext();
    };
    script.onerror = tryNext;
    document.head.appendChild(script);
  }

  tryNext();
}

function startApp() {
  const subtitle = document.getElementById("app-subtitle");
  if (subtitle && window.appInfo?.version) {
    subtitle.textContent = `Scientific G-code generation and experiment simulation · v${window.appInfo.version}`;
  }
  if (!document.body.dataset.appMode) {
    document.body.dataset.appMode = "standard";
  }

  if (coreIsReady()) {
    loadRendererScript();
    return;
  }

  loadCoreScript(loadRendererScript, (message) => {
    const detail = [
      window.GcodeCoreLoadError || "",
      `location: ${window.location.href}`,
      `tried: ${coreScriptCandidates().join("\n")}`,
    ]
      .filter(Boolean)
      .join("\n\n");
    showBootFailure(message, detail);
  });
}

startApp();
