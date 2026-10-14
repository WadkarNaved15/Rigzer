// src/components/Post/PocketPost.tsx

import React, { memo, useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
const POCKET_HEIGHT = 550;

interface User { username: string; avatar?: string; }
interface PocketPostProps {
  _id: string; user: User; createdAt: string;
  likesCount?: number; isLiked?: boolean; commentsCount?: number;
  brandName: string; tagline?: string; compiledBundleUrl: string;
  onOpenDetails?: () => void; disableInteractions?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
}

async function fetchBundleText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function secureFullHtmlPreview(html: string): string {
  const csp = [
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

  const cspTag =
    `<meta http-equiv="Content-Security-Policy" content="${csp}">`;

  // Remove an existing CSP to avoid conflicting policies.
  const cleanHtml = html.replace(
    /<meta\b[^>]*http-equiv\s*=\s*["']?Content-Security-Policy["']?[^>]*>/gi,
    ""
  );

  if (/<head(?:\s[^>]*)?>/i.test(cleanHtml)) {
    return cleanHtml.replace(
      /<head(?:\s[^>]*)?>/i,
      (head) => `${head}\n${cspTag}`
    );
  }

  if (/<html(?:\s[^>]*)?>/i.test(cleanHtml)) {
    return cleanHtml.replace(
      /<html(?:\s[^>]*)?>/i,
      (tag) => `${tag}\n<head>${cspTag}</head>`
    );
  }

  return cleanHtml;
}


function buildSrcdoc(jsx: string): string {
const source = jsx.trim()
  .replace(/^```(?:html)?\s*/i, "")
  .replace(/\s*```$/, "")
  .trim();

if (/<(?:!doctype\s+html|html|head|body)\b/i.test(source)) {
  console.warn("Full HTML detected in PocketEditor source code. Using secure CSP wrapper.");
  return secureFullHtmlPreview(source);
}

  // JSX/React preview.
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <style>
      *, *::before, *::after { box-sizing: border-box; }
      html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: transparent; }
      #root { width: 100%; height: 100%; overflow: hidden; }
    </style>
</head>
<body>
  <div id="root"></div>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script>
    (function run() {
      if (!window.React || !window.ReactDOM || !window.Babel) {
        return setTimeout(run, 50);
      }

      var src = ${JSON.stringify(jsx)};

      try {
        window.Babel.registerPlugin('strip-imports', function() {
          return {
            visitor: {
              ImportDeclaration: function(path) { path.remove(); },
              ExportDefaultDeclaration: function(path) { path.remove(); },
              ExportNamedDeclaration: function(path) { path.remove(); },
              ExportAllDeclaration: function(path) { path.remove(); }
            }
          };
        });

        var compiled = window.Babel.transform(src, {
          presets: [["react", { runtime: "classic" }]],
          plugins: ["strip-imports"]
        }).code;

        var wrapped = compiled +
          "\\n;if(typeof PocketApp!=='undefined'){window.PocketApp=PocketApp;}";

        (0, eval)(wrapped);

        var App = window.PocketApp;
        if (typeof App !== "function") {
          throw new Error(
            "No PocketApp function found. Declare const PocketApp = () => { ... }"
          );
        }

        window.ReactDOM.createRoot(document.getElementById("root"))
          .render(window.React.createElement(App));
      } catch (err) {
        document.getElementById("root").innerHTML =
          '<pre style="color:#f87171;padding:12px;white-space:pre-wrap;">' +
          String(err.message).replace(/</g, "&lt;") +
          '</pre>';
      }
    })();
  </script>
</body>
</html>`;
}


const PocketPost: React.FC<PocketPostProps> = ({
  _id, user, brandName, tagline, compiledBundleUrl, onOpenDetails,onPrev, onNext
}) => {
  const postRef = useRef<HTMLElement>(null);
  const viewStart = useRef<number | null>(null);
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
  const navigate = useNavigate();
  const [srcdoc, setSrcdoc] = useState<string | null>(null);
  const [fetchErr, setFetchErr] = useState<string | null>(null);

  useEffect(() => {
    const handlePocketNavigation = (event: MessageEvent) => {
      const data = event.data;
      console.log("Received message from Pocket iframe:", data);

      if (!data || data.type !== "RIGZER_NAVIGATE") return;

      if (typeof data.path !== "string") return;

      // Only allow internal routes
      if (!data.path.startsWith("/")) return;

      navigate(data.path);
    };

    window.addEventListener("message", handlePocketNavigation);

    return () => {
      window.removeEventListener("message", handlePocketNavigation);
    };
  }, [navigate]);

  useEffect(() => {
    let cancelled = false;
    setSrcdoc(null);
    setFetchErr(null);
    fetchBundleText(compiledBundleUrl)
      .then(code => { if (!cancelled) setSrcdoc(buildSrcdoc(code)); })
      .catch(err => { if (!cancelled) setFetchErr(String(err.message)); });
    return () => { cancelled = true; };
  }, [compiledBundleUrl]);


  // Stable track function — wrapped in useCallback so the analytics
  // useEffect doesn't need to re-run when the component re-renders.
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
  }, [track]); // track is stable — this effect runs once

  return (
    <article
      ref={postRef}
      className="relative w-full bg-transparent"
    >
      <div
        style={{
          width: "100%",
          height: POCKET_HEIGHT,
          position: "relative",
          background:"transparent",
          // backgroundImage: "url('/defaultBackground.jpeg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        onClick={() => onOpenDetails?.()}
      >
        {/* 🔥 INNER POCKET (slightly smaller → border visible) */}
        <div
          style={{
            width: "100%",
            height: "100%",
            overflow: "hidden",
            background: "transparent",

            display: "flex",
            flexDirection: "column",

            // borderTopLeftRadius: "28px",
            // borderTopRightRadius: "28px",
            borderBottomLeftRadius: "12px",
            borderBottomRightRadius: "12px",
          }}
        >
          {/* Pocket Header */}
          {/* <div
            onClick={() => onOpenDetails?.()}
            style={{
              flexShrink: 0,

              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              gap: "10px",

              background: "rgba(32, 30, 31, 0.96)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
            }}
          >
            <img
              src={user.avatar || "/default_avatar.png"}
              alt={user.username}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/profile/${user.username}`);
              }}
              style={{
                width: "30px",
                height: "30px",
                borderRadius: "999px",
                objectFit: "cover",
                flexShrink: 0,
                border: "2px solid rgba(255,255,255,0.15)",
              }}
            />

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                minWidth: 0,
                flex: 1,
              }}
            >
              <span
                style={{
                  color: "white",
                  fontWeight: 800,
                  fontSize: "14px",
                  lineHeight: 1.1,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {brandName}
              </span>

              {tagline && (
                <span
                  style={{
                    color: "rgba(255,255,255,0.72)",
                    fontSize: "11px",
                    marginTop: "3px",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {tagline}
                </span>
              )}
            </div> */}

            {/* Arrows */}
            {/* <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flexShrink: 0,
              }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPrev?.();
                }}
                style={{
                  border: "none",
                  background: "rgba(255,255,255,0.08)",
                  color: "white",
                  borderRadius: "999px",
                  width: "28px",
                  height: "28px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <ArrowLeft size={14} />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onNext?.();
                }}
                style={{
                  border: "none",
                  background: "rgba(255,255,255,0.08)",
                  color: "white",
                  borderRadius: "999px",
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <ArrowRight size={14} />
              </button>
            </div>
          </div> */}

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
              flex: 1, width: "100%", background: "#0a0a0a",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              Error
            </div>
          )}

          {srcdoc && (
            <iframe
              key={compiledBundleUrl}
              title={`pocket-${_id}`}
              srcDoc={srcdoc}
              sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
              style={{
                flex: 1,
                width: "100%",
                border: "none",
                display: "block",
              }}
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