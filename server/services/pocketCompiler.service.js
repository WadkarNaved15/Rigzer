// services/pocketCompiler.service.js
import * as Babel from "@babel/core";
import presetReact from "@babel/preset-react";
import presetEnv   from "@babel/preset-env";

/**
 * Wraps creator JSX so the bundle is fully self-contained:
 *  - polls for window.React / window.ReactDOM itself (no injection-order dependency)
 *  - aliases React/ReactDOM locally so creator JSX works with bare identifiers
 *  - mounts PocketApp once globals are confirmed ready
 */
function wrapSource(raw) {
  return `
(function mount() {
  // Poll until the iframe host has set window.React and window.ReactDOM.
  // This makes the bundle safe regardless of whether it loads before or
  // after the host module script — dynamic <script> tags are always async.
  if (!window.React || !window.ReactDOM || !window.ReactDOM.createRoot) {
    return setTimeout(mount, 30);
  }

  var React    = window.React;
  var ReactDOM = window.ReactDOM;

  // ── Creator source (uses bare React / ReactDOM — both aliased above) ──────
  ${raw}
  // ─────────────────────────────────────────────────────────────────────────

  if (typeof PocketApp === "undefined") {
    console.error("[Pocket] No PocketApp component found. Name your root component PocketApp.");
    return;
  }

  var root = document.getElementById("root");
  if (!root) { console.error("[Pocket] #root element not found."); return; }

  ReactDOM.createRoot(root).render(React.createElement(PocketApp));
})();
`;
}

export async function compilePocketBundle(sourceCode) {
  const result = await Babel.transformAsync(wrapSource(sourceCode), {
    presets: [
      [presetEnv, { targets: { browsers: [">1%", "last 2 versions"] }, modules: false }],
      [presetReact, { runtime: "classic" }],
    ],
    sourceMaps: false,
    sourceType: "script",
    compact:    true,
  });

  if (!result?.code) throw new Error("Babel returned empty output");
  return result.code;
}