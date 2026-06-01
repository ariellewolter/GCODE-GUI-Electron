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
  document.body.appendChild(script);
}

function loadCoreFromFileUrl(onReady, onError) {
  const src = window.__gcodeCoreScriptSrc;
  if (!src) {
    onError("Core script path was not provided by preload.");
    return;
  }
  const script = document.createElement("script");
  script.src = src;
  script.onload = () => {
    if (coreIsReady()) onReady();
    else onError("gcode-core.js loaded but did not define GcodeCore.");
  };
  script.onerror = () => onError("Failed to load gcode-core.js from the app bundle.");
  document.head.appendChild(script);
}

function startApp() {
  if (!document.body.dataset.appMode) {
    document.body.dataset.appMode = "standard";
  }

  if (coreIsReady()) {
    loadRendererScript();
    return;
  }

  loadCoreFromFileUrl(loadRendererScript, (message) => {
    const detail = window.GcodeCoreLoadError || "";
    showBootFailure(message, detail);
  });
}

startApp();
