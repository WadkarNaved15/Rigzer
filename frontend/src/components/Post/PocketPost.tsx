// src/components/Post/PocketPost.tsx
import React, { memo, useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";

const POCKET_HEIGHT = 550;

interface User { username: string; avatar?: string; }
interface PocketPostProps {
  _id: string; user: User; createdAt: string;
  likesCount?: number; isLiked?: boolean; commentsCount?: number;
  brandName: string; tagline?: string; compiledBundleUrl: string;
  sourceType?: "jsx" | "html";            // optional; falls back to the URL extension
  onOpenDetails?: () => void; disableInteractions?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
}

// CSP for the JSX host page. Scripts: inline (the compiled bundle) + React from unpkg only.
// No eval, so Babel Standalone is deliberately not allowed here.
const JSX_HOST_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' https://unpkg.com",
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

function isHtmlBundle(url: string, sourceType?: "jsx" | "html"): boolean {
  if (sourceType) return sourceType === "html";
  return /\.html?(?:[?#]|$)/i.test(url);   // server uploads HTML pockets as bundle-<ts>.html
}

async function fetchBundleText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// JSX pockets arrive already compiled by the server (self-mounting into #root).
// Host them with React only — no Babel in the viewer's browser.
function buildJsxHost(bundle: string): string {
  // Keep the bundle from closing the <script> tag or opening an HTML comment.
  const safeBundle = bundle
    .replace(/<\/script/gi, "<\\/script")
    .replace(/<!--/g, "<\\!--");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta http-equiv="Content-Security-Policy" content="${JSX_HOST_CSP}">
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: transparent; }
    #root { width: 100%; height: 100%; overflow: hidden; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
  <script>${safeBundle}</script>
</body>
</html>`;
}

const PocketPost: React.FC<PocketPostProps> = ({
  _id, brandName, compiledBundleUrl, sourceType, onOpenDetails,
}) => {
  const postRef   = useRef<HTMLElement>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const viewStart = useRef<number | null>(null);
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
  const navigate = useNavigate();
  const [srcdoc, setSrcdoc]     = useState<string | null>(null);
  const [fetchErr, setFetchErr] = useState<string | null>(null);

  // Internal navigation requested by the pocket. Only accept messages from THIS
  // post's iframe, otherwise every post in the feed would navigate at once.
  useEffect(() => {
    const handlePocketNavigation = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;

      const data = event.data;
      if (!data || data.type !== "RIGZER_NAVIGATE") return;
      if (typeof data.path !== "string") return;

      const path: string = data.path;
      if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return;

      navigate(path);
    };

    window.addEventListener("message", handlePocketNavigation);
    return () => window.removeEventListener("message", handlePocketNavigation);
  }, [navigate]);

  // Load the published bundle and turn it into the iframe document.
  useEffect(() => {
    let cancelled = false;
    setSrcdoc(null);
    setFetchErr(null);

    fetchBundleText(compiledBundleUrl)
      .then(text => {
        if (cancelled) return;
        // HTML: the server already wrapped it with the CSP, so use it as-is.
        // JSX:  already compiled, so host it with React.
        setSrcdoc(isHtmlBundle(compiledBundleUrl, sourceType) ? text : buildJsxHost(text));
      })
      .catch(err => { if (!cancelled) setFetchErr(String(err.message)); });

    return () => { cancelled = true; };
  }, [compiledBundleUrl, sourceType]);

  const track = useCallback((event: string, seconds?: number) => {
    fetch(`${BACKEND_URL}/api/pockets/entries/${_id}/analytics`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, seconds }),
    }).catch(() => { });
  }, [BACKEND_URL, _id]);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        viewStart.current = Date.now();
        track("impression");
      } else if (viewStart.current) {
        track("engagement", Math.floor((Date.now() - viewStart.current) / 1000));
        viewStart.current = null;
      }
    }, { threshold: 0.5 });
    if (postRef.current) observer.observe(postRef.current);
    return () => observer.disconnect();
  }, [track]);

  return (
    <article ref={postRef} className="relative w-full bg-transparent">
      <div
        style={{
          width: "100%",
          height: POCKET_HEIGHT,
          position: "relative",
          background: "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        onClick={() => onOpenDetails?.()}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            overflow: "hidden",
            background: "transparent",
            display: "flex",
            flexDirection: "column",
            borderBottomLeftRadius: "12px",
            borderBottomRightRadius: "12px",
          }}
        >
          {!srcdoc && !fetchErr && (
            <div
              style={{
                flex: 1,
                width: "100%",
                background: "linear-gradient(90deg,#1a1a1a 25%,#222 50%,#1a1a1a 75%)",
                backgroundSize: "200% 100%",
                animation: "shimmer 1.4s infinite",
              }}
            />
          )}

          {fetchErr && (
            <div style={{
              flex: 1, width: "100%", background: "#0a0a0a", color: "rgba(255,255,255,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12,
            }}>
              Couldn't load this pocket
            </div>
          )}

          {srcdoc && (
            <iframe
              key={compiledBundleUrl}
              ref={iframeRef}
              title={`pocket-${brandName || _id}`}
              srcDoc={srcdoc}
              sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
              referrerPolicy="no-referrer"
              style={{ flex: 1, width: "100%", border: "none", display: "block" }}
            />
          )}
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </article>
  );
};

export default memo(PocketPost);