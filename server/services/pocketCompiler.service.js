import * as Babel from "@babel/core";
import presetReact from "@babel/preset-react";
import presetEnv   from "@babel/preset-env";


const HAS_DOC_TAG = /<(?:!doctype\s+html|html|head|body)\b/i;

const CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com data:",
  "img-src data: https: blob:",
  "media-src data: https: blob:",
  "connect-src 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

const CSP_TAG = `<meta http-equiv="Content-Security-Policy" content="${CSP}">`;

export function stripFences(code) {
  return String(code)
    .trim()
    .replace(/^```(?:html|jsx|tsx|js)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

// Must stay identical to looksLikeHtml() in the frontend pocketPreview.ts
export function isHtmlSource(code) {
  const s = stripFences(code);
  if (HAS_DOC_TAG.test(s)) return true;
  return /^\s*</.test(s) && !/\bPocketApp\b/.test(s);
}

export function buildHtmlDocument(code, height = 550) {
  let html = stripFences(code).replace(
    /<meta\b[^>]*http-equiv\s*=\s*["']?Content-Security-Policy["']?[^>]*>/gi,
    ""
  );

  if (!HAS_DOC_TAG.test(html)) {
    html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<style>*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;width:100%;height:${height}px;overflow:hidden}</style>
</head><body>
${html}
</body></html>`;
  }

  if (/<head(?:\s[^>]*)?>/i.test(html))
    return html.replace(/<head(?:\s[^>]*)?>/i, (m) => `${m}\n${CSP_TAG}`);
  if (/<html(?:\s[^>]*)?>/i.test(html))
    return html.replace(/<html(?:\s[^>]*)?>/i, (m) => `${m}\n<head>${CSP_TAG}</head>`);
  return `<!DOCTYPE html><html><head>${CSP_TAG}</head>${html}</html>`;
}

function wrapSource(raw) {
  return `
(function mount() {
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
  if (isHtmlSource(sourceCode)) {
    throw new Error("HTML source must be published as HTML, not compiled as JSX");
  }

  // Strip ``` fences so pasted markdown code blocks compile too.
  const cleaned = stripFences(sourceCode);

  const result = await Babel.transformAsync(wrapSource(cleaned), {
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