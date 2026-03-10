// src/components/Post/PocketPost.tsx

import React, { memo, useEffect, useRef, useState, useCallback } from "react";

const POCKET_HEIGHT = 480;  

interface User { username: string; avatar?: string; }
interface PocketPostProps {
  _id: string; user: User; createdAt: string;
  likesCount?: number; isLiked?: boolean; commentsCount?: number;
  brandName: string; tagline?: string; compiledBundleUrl: string;
  onOpenDetails?: () => void; disableInteractions?: boolean;
}

async function fetchBundleText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function buildSrcdoc(bundleCode: string): string {
  const safeCode = bundleCode.replace(/<\/script>/gi, "<\\/script>");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' https://esm.sh; style-src 'unsafe-inline'; img-src https: data: blob:; media-src https: blob:; connect-src 'none';"/>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:${POCKET_HEIGHT}px;overflow:hidden;background:transparent}
#root{width:100%;height:${POCKET_HEIGHT}px;overflow:hidden}
</style>
</head>
<body>
<div id="root"></div>
<script type="module">
import React    from "https://esm.sh/react@18";
import ReactDOM from "https://esm.sh/react-dom@18/client";
window.React    = React;
window.ReactDOM = ReactDOM;
</script>
<script>
window.addEventListener('error', function(e) {
  var r = document.getElementById('root');
  if (r) r.innerHTML =
    '<div style="padding:14px;font-family:monospace;font-size:11px;color:#f87171;background:#0a0a0a;height:100%;box-sizing:border-box;overflow:auto">' +
    '<b>Runtime error:</b><br/><br/>' + String(e.message||'').replace(/</g,'&lt;') +
    (e.lineno ? '<br/><span style="opacity:.4">line '+e.lineno+'</span>' : '') + '</div>';
});
${safeCode}
</script>
</body>
</html>`;
}

const PocketPost: React.FC<PocketPostProps> = ({
  _id, user, brandName, tagline, compiledBundleUrl, onOpenDetails,
}) => {
  const postRef   = useRef<HTMLElement>(null);
  const viewStart = useRef<number | null>(null);
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

  const [srcdoc, setSrcdoc]     = useState<string | null>(null);
  const [fetchErr, setFetchErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSrcdoc(null);
    setFetchErr(null);
    fetchBundleText(compiledBundleUrl)
      .then(code => { if (!cancelled) setSrcdoc(buildSrcdoc(code)); })
      .catch(err  => { if (!cancelled) setFetchErr(String(err.message)); });
    return () => { cancelled = true; };
  }, [compiledBundleUrl]);


  // Stable track function — wrapped in useCallback so the analytics
  // useEffect doesn't need to re-run when the component re-renders.
  const track = useCallback((event: string, seconds?: number) => {
    fetch(`${BACKEND_URL}/api/pockets/entries/${_id}/analytics`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, seconds }),
    }).catch(() => {});
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
      className="relative w-full border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-[#0f0f0f]"
    >
      <div
        style={{ width: "100%", height: POCKET_HEIGHT, overflow: "hidden", position: "relative" }}
        onClick={() => onOpenDetails?.()}
      >
        {!srcdoc && !fetchErr && (
          <div style={{
            width: "100%", height: "100%",
            background: "linear-gradient(90deg,#1a1a1a 25%,#222 50%,#1a1a1a 75%)",
            backgroundSize: "200% 100%",
            animation: "shimmer 1.4s infinite",
          }} />
        )}

        {fetchErr && (
          <div style={{
            width: "100%", height: "100%", background: "#0a0a0a",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexDirection: "column", gap: 8, padding: 20,
          }}>
            <p style={{ color: "#f87171", fontFamily: "monospace", fontSize: 12, textAlign: "center" }}>
              Failed to load pocket<br/>
              <span style={{ opacity: 0.4, fontSize: 10 }}>{fetchErr}</span>
            </p>
          </div>
        )}

        {srcdoc && (
          <iframe
            key={compiledBundleUrl}
            title={`pocket-${_id}`}
            srcDoc={srcdoc}          // ← capital D (React prop name)
            sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
            style={{ width: "100%", height: "100%", border: "none", display: "block" }}
            referrerPolicy="no-referrer"
          />
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 flex items-center gap-3">
        <img src={user.avatar || "/default_avatar.png"} alt={user.username}
          className="h-8 w-8 rounded-full object-cover flex-shrink-0 cursor-pointer"
          onClick={() => onOpenDetails?.()} />

        <div className="flex flex-col flex-1 min-w-0 cursor-pointer" onClick={() => onOpenDetails?.()}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black text-sm text-black dark:text-white leading-tight truncate">{brandName}</span>
            {tagline && <span className="text-xs text-gray-500 dark:text-zinc-500 truncate">{tagline}</span>}
          </div>
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