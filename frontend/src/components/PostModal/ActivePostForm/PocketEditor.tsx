// src/components/postModal/ActivePostForm/PocketEditor.tsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Code2, Eye, Sparkles, Info, Send,
  ChevronDown, ChevronUp, AlertCircle, CheckCircle2,
  ImagePlus, Film, Trash2, Copy, Check, Loader2, Images,
} from "lucide-react";
import type { PocketEditorProps } from "../../../types/Post";

// ─── Types ────────────────────────────────────────────────────────────────────
interface MediaFile {
  s3Key:  string;
  url:    string;
  sizeMB: number;
  type:   "image" | "video";
  name:   string;
}

// ─── Fixed canvas size — MUST match PocketPost.tsx ───────────────────────────
const POCKET_HEIGHT = 480;

// ─── Starter template ─────────────────────────────────────────────────────────
const STARTER_CODE = `// NVIDIA Sponsored Pocket — Rigzer Cloud Gaming
// Pure inline styles — no Tailwind needed.
// Fixed 480px canvas. Design within this space.

const PocketApp = () => {
  const [tab, setTab]           = React.useState("geforce");
  const [hovered, setHovered]   = React.useState(null);
  const [pulse, setPulse]       = React.useState(false);

  React.useEffect(() => {
    const t = setInterval(() => setPulse(p => !p), 1600);
    return () => clearInterval(t);
  }, []);

  const GREEN = "#76b900";
  const BG    = "#0c0c0c";

  const tabs = [
    { id: "geforce", label: "GeForce NOW" },
    { id: "rtx",     label: "RTX GPUs"   },
    { id: "dlss",    label: "DLSS 4"     },
  ];

  const pages = {
    geforce: {
      headline: "Play Any Game. Any Device.",
      sub: "Stream RTX-powered games instantly on Rigzer — no console, no downloads, no waiting.",
      cards: [
        { icon: "⚡", title: "Instant Stream",  desc: "Click Play on any Rigzer post and you're in. Zero load." },
        { icon: "🖥️", title: "4K / 120fps",     desc: "GeForce NOW Ultimate — full RTX 4080 in the cloud." },
        { icon: "🌍", title: "Any Device",      desc: "PC, Mac, mobile or TV. Your library goes everywhere." },
      ],
      cta: "Try GeForce NOW Free →",
      url: "https://www.nvidia.com/en-us/geforce-now/",
    },
    rtx: {
      headline: "The GPU Behind Every Frame.",
      sub: "Every game streamed on Rigzer runs on NVIDIA RTX data-centre GPUs — ray tracing at cloud scale.",
      cards: [
        { icon: "🔆", title: "Ray Tracing",   desc: "Physically accurate light, shadow and reflections in real time." },
        { icon: "🧠", title: "AI Rendering",  desc: "Neural networks generate frames no GPU could produce alone." },
        { icon: "🎮", title: "Game Ready",    desc: "Optimised drivers ship the same day every major title drops." },
      ],
      cta: "Explore RTX →",
      url: "https://www.nvidia.com/en-us/geforce/graphics-cards/",
    },
    dlss: {
      headline: "More Frames. Less Effort.",
      sub: "DLSS 4 uses AI to multiply frame rates. Every Rigzer cloud stream is DLSS-accelerated automatically.",
      cards: [
        { icon: "🚀", title: "Frame Gen ×4",       desc: "Generate up to 3 extra AI frames per rendered frame." },
        { icon: "🔬", title: "Ray Reconstruction",  desc: "AI denoiser for cleaner, sharper ray-traced images." },
        { icon: "📈", title: "+240% FPS",           desc: "Average performance uplift across supported titles." },
      ],
      cta: "Learn DLSS 4 →",
      url: "https://www.nvidia.com/en-us/geforce/technologies/dlss/",
    },
  };

  const p = pages[tab];

  const s = {
    root: {
      width: "100%", height: "480px", background: BG, overflow: "hidden",
      display: "flex", flexDirection: "column", position: "relative",
      fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
      boxSizing: "border-box",
    },
    gridBg: {
      position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.045,
      backgroundImage: "linear-gradient(#76b900 1px,transparent 1px),linear-gradient(90deg,#76b900 1px,transparent 1px)",
      backgroundSize: "36px 36px",
    },
    glow: {
      position: "absolute", top: -80, right: -80, width: 240, height: 240,
      borderRadius: "50%", pointerEvents: "none",
      background: "radial-gradient(circle, rgba(118,185,0,0.22) 0%, transparent 70%)",
    },
    header: {
      position: "relative", zIndex: 2,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "12px 18px 10px",
      borderBottom: "1px solid rgba(118,185,0,0.14)",
    },
    headerLeft:  { display: "flex", alignItems: "center", gap: 10 },
    nvidiaTag: {
      background: GREEN, color: "#000", fontWeight: 900,
      fontSize: 12, letterSpacing: 3, textTransform: "uppercase",
      padding: "3px 9px", borderRadius: 4,
    },
    partnerLabel: { color: "rgba(255,255,255,0.32)", fontSize: 11 },
    headerRight: { display: "flex", alignItems: "center", gap: 7 },
    dot: (on) => ({
      width: 7, height: 7, borderRadius: "50%", transition: "all 0.7s",
      background: on ? GREEN : "rgba(118,185,0,0.22)",
      boxShadow: on ? ("0 0 10px " + GREEN) : "none",
    }),
    sponsoredLabel: { color: "rgba(255,255,255,0.32)", fontSize: 9, letterSpacing: 2 },
    tabRow: {
      position: "relative", zIndex: 2,
      display: "flex", gap: 6, padding: "10px 18px 0",
    },
    tab: (active) => ({
      padding: "5px 15px", borderRadius: 20, border: "none", cursor: "pointer",
      fontSize: 11, fontWeight: 700, letterSpacing: 0.4, transition: "all 0.2s",
      background: active ? GREEN : "rgba(255,255,255,0.07)",
      color:      active ? "#000" : "rgba(255,255,255,0.48)",
      transform:  active ? "scale(1.05)" : "scale(1)",
    }),
    body: {
      position: "relative", zIndex: 2, flex: 1,
      padding: "13px 18px 0", overflow: "hidden",
    },
    headline: {
      margin: "0 0 5px", color: "#fff", fontWeight: 900,
      fontSize: 17, letterSpacing: "-0.03em", lineHeight: 1.2,
    },
    sub: {
      margin: "0 0 13px", lineHeight: 1.55, fontSize: 11.5,
      color: "rgba(255,255,255,0.42)", maxWidth: 430,
    },
    cards: {
      display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
      gap: 8, marginBottom: 14,
    },
    card: (on) => ({
      borderRadius: 10, padding: "10px 11px", transition: "all 0.18s",
      border: on ? ("1px solid " + GREEN) : "1px solid rgba(255,255,255,0.08)",
      background: on ? "rgba(118,185,0,0.09)" : "rgba(255,255,255,0.03)",
      cursor: "default",
    }),
    cardIcon:  { fontSize: 17, marginBottom: 5 },
    cardTitle: (on) => ({
      fontSize: 11, fontWeight: 800, marginBottom: 3, transition: "color 0.18s",
      color: on ? GREEN : "#fff",
    }),
    cardDesc:  { fontSize: 10, lineHeight: 1.45, color: "rgba(255,255,255,0.36)" },
    ctaRow:    { display: "flex", alignItems: "center", gap: 14 },
    cta: {
      display: "inline-block", textDecoration: "none",
      background: GREEN, color: "#000", fontWeight: 900,
      fontSize: 11.5, letterSpacing: 0.4,
      padding: "9px 20px", borderRadius: 8,
      boxShadow: "0 0 22px rgba(118,185,0,0.38)", cursor: "pointer",
      transition: "transform 0.15s",
    },
    poweredBy: { fontSize: 10, color: "rgba(255,255,255,0.18)" },
    footer: {
      position: "relative", zIndex: 2,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "7px 18px",
      borderTop: "1px solid rgba(118,185,0,0.1)",
    },
    footerLeft:  { fontSize: 9, color: "rgba(255,255,255,0.16)", letterSpacing: 0.3 },
    footerLinks: { display: "flex", gap: 12 },
    footerLink:  { fontSize: 9, color: "rgba(255,255,255,0.2)", cursor: "pointer" },
  };

  return (
    <div style={s.root}>
      <div style={s.gridBg} />
      <div style={s.glow} />

      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <span style={s.nvidiaTag}>NVIDIA</span>
          <span style={s.partnerLabel}>× Rigzer Cloud Gaming</span>
        </div>
        <div style={s.headerRight}>
          <div style={s.dot(pulse)} />
          <span style={s.sponsoredLabel}>SPONSORED</span>
        </div>
      </div>

      {/* Tabs */}
      <div style={s.tabRow}>
        {tabs.map(t => (
          <button key={t.id} style={s.tab(tab === t.id)} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={s.body}>
        <h2 style={s.headline}>{p.headline}</h2>
        <p style={s.sub}>{p.sub}</p>

        <div style={s.cards}>
          {p.cards.map((card, i) => (
            <div
              key={i}
              style={s.card(hovered === i)}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <div style={s.cardIcon}>{card.icon}</div>
              <div style={s.cardTitle(hovered === i)}>{card.title}</div>
              <div style={s.cardDesc}>{card.desc}</div>
            </div>
          ))}
        </div>

        <div style={s.ctaRow}>
          <a
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            style={s.cta}
            onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
            onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
          >
            {p.cta}
          </a>
          <span style={s.poweredBy}>Powered by NVIDIA RTX Infrastructure</span>
        </div>
      </div>

      {/* Footer */}
      <div style={s.footer}>
        <span style={s.footerLeft}>© 2025 NVIDIA Corporation. All rights reserved.</span>
        <div style={s.footerLinks}>
          {["Privacy", "Terms", "Advertise"].map(l => (
            <span key={l} style={s.footerLink}>{l}</span>
          ))}
        </div>
      </div>
    </div>
  );
};`;

// ─── Preview iframe document ──────────────────────────────────────────────────
function buildPreviewDoc(jsx: string, height: number): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <meta http-equiv="Content-Security-Policy" content="
    script-src  'unsafe-inline' 'unsafe-eval' https://unpkg.com https://esm.sh;
    style-src   'unsafe-inline' https://fonts.googleapis.com;
    font-src    https://fonts.gstatic.com;
    img-src     https: data: blob:;
    media-src   https: blob:;
    default-src 'none';
  "/>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%;
      height: ${height}px;
      overflow: hidden;
      background: transparent;
    }
    #root {
      width: 100%;
      height: ${height}px;
      overflow: hidden;
    }
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
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script>
    (function run() {
      if (!window.React || !window.ReactDOM || !window.Babel) {
        return setTimeout(run, 50);
      }
      var src = ${JSON.stringify(jsx)};
      try {
        var compiled = Babel.transform(src, { presets: ["react"], plugins: [] }).code;
        var sloppy  = compiled.replace(/^\\s*["']use strict["'];?\\s*/m, "");
        var wrapped = sloppy + "\\n;if(typeof PocketApp!=='undefined'){window.PocketApp=PocketApp;}";
        (0, eval)(wrapped);
        var App = window.PocketApp;
        if (typeof App !== "function") {
          document.getElementById("root").innerHTML =
            '<p style="color:#f87171;padding:16px;font-family:sans-serif;font-size:13px">No PocketApp found. Name your component exactly:<br><br><code style="background:#1a1a1a;padding:4px 8px;border-radius:4px">const PocketApp = () =&gt; { ... }</code></p>';
          return;
        }
        window.ReactDOM.createRoot(document.getElementById("root"))
                       .render(window.React.createElement(App));
      } catch (err) {
        document.getElementById("root").innerHTML =
          '<pre style="color:#f87171;padding:12px;font-size:11px;font-family:monospace;white-space:pre-wrap;overflow:auto">' +
          err.message.replace(/</g, "&lt;") + "</pre>";
      }
    })();
  </script>
</body>
</html>`;
}

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bannerBg?: string; bannerBorder?: string }> = {
  draft:          { label: "Draft",     color: "text-gray-400" },
  pending_review: { label: "In Review", color: "text-amber-500", bannerBg: "bg-amber-50 dark:bg-amber-900/10",  bannerBorder: "border-amber-200 dark:border-amber-800" },
  rejected:       { label: "Rejected",  color: "text-red-500",   bannerBg: "bg-red-50 dark:bg-red-900/10",      bannerBorder: "border-red-200 dark:border-red-800" },
  live:           { label: "Live ✓",    color: "text-violet-500" },
};

// ─── CopyButton ───────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      title="Copy URL"
      className="p-1.5 rounded-lg hover:bg-zinc-700 transition text-zinc-400 hover:text-white"
    >
      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
    </button>
  );
}

// ─── Insert snippet at textarea cursor ───────────────────────────────────────
// FIX (TS2345): accept RefObject<HTMLTextAreaElement | null> to match useRef's type
function insertAtCursor(
  ref: React.RefObject<HTMLTextAreaElement | null>,
  code: string,
  setCode: (v: string) => void,
  snippet: string,
  savedPos?: { start: number; end: number }
) {
  const ta = ref.current;
  if (!ta) { setCode((code + "\n" + snippet).slice(0, 60_000)); return; }
  const s    = savedPos?.start ?? ta.selectionStart;
  const e    = savedPos?.end   ?? ta.selectionEnd;
  const next = (code.slice(0, s) + snippet + code.slice(e)).slice(0, 60_000);
  setCode(next);
  requestAnimationFrame(() => {
    ta.selectionStart = ta.selectionEnd = s + snippet.length;
    ta.focus();
  });
}

// ─── Component ────────────────────────────────────────────────────────────────
// FIX (no-unused-vars): destructure onCancel with underscore prefix so ESLint
// knows it's intentionally unused (modal container handles close, not PocketEditor)
const PocketEditor: React.FC<PocketEditorProps> = ({ onCancel: _onCancel }) => {
  const [tab, setTab]               = useState<"code" | "media" | "preview">("code");
  const [brandName, setBrandName]   = useState("");
  const [tagline, setTagline]       = useState("");
  const [sourceCode, setSourceCode]       = useState(STARTER_CODE);
  const [savedSourceCode, setSavedSourceCode] = useState(STARTER_CODE);
  const [status, setStatus]               = useState("draft");
  const [reviewNote, setReviewNote]       = useState<string | null>(null);
  const [isSaving, setIsSaving]     = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading]   = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showTips, setShowTips]     = useState(false);

  // Media
  const [mediaFiles, setMediaFiles]     = useState<MediaFile[]>([]);
  const [isUploading, setIsUploading]   = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [deletingKey, setDeletingKey]   = useState<string | null>(null);

  // FIX (TS2345): useRef<HTMLTextAreaElement | null> so it's assignable to
  // insertAtCursor's updated RefObject<HTMLTextAreaElement | null> param
  const textareaRef   = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const lastCursorPos = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
  const BACKEND_URL   = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

  // ── Mount: load pocket + media ─────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [pr, mr] = await Promise.all([
          fetch(`${BACKEND_URL}/api/pockets/mine`,  { credentials: "include" }),
          fetch(`${BACKEND_URL}/api/pockets/media`, { credentials: "include" }),
        ]);
        const pd = await pr.json();
        const md = await mr.json();
        if (pd.pocket) {
          setBrandName(pd.pocket.brandName ?? "");
          setTagline(pd.pocket.tagline ?? "");
          setStatus(pd.pocket.status ?? "draft");
          setReviewNote(pd.pocket.reviewNote ?? null);
          if (pd.pocket.sourceCode) { setSourceCode(pd.pocket.sourceCode); setSavedSourceCode(pd.pocket.sourceCode); }
        }
        if (md.files) setMediaFiles(md.files);
      } catch { /* first-time */ } finally {
        setIsLoading(false);
      }
    })();
  }, [BACKEND_URL]);

  // ── Tab-key support ───────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const ta = textareaRef.current!;
    const s  = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = sourceCode.slice(0, s) + "  " + sourceCode.slice(end);
    setSourceCode(next);
    requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = s + 2; });
  };

  const flashSuccess = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(null), 3500); };
  const flashError   = (msg: string) => { setError(msg);      setTimeout(() => setError(null), 5000); };

  // ── Save ──────────────────────────────────────────────────────────────────
  // FIX (no-explicit-any): catch (err: unknown) + instanceof guard
  const handleSave = async (): Promise<boolean> => {
    if (isSaving || !brandName.trim() || status === "pending_review") return false;
    setIsSaving(true);
    try {
      const res  = await fetch(`${BACKEND_URL}/api/pockets`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandName, tagline, sourceCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setStatus(data.pocket.status);
      setSavedSourceCode(sourceCode);
      flashSuccess("Draft saved ✓");
      return true;
    } catch (err: unknown) {
      flashError(err instanceof Error ? err.message : "Save failed");
      return false;
    } finally { setIsSaving(false); }
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (isSubmitting) return;
    const saved = await handleSave();
    if (!saved) return;
    setIsSubmitting(true);
    try {
      const res  = await fetch(`${BACKEND_URL}/api/pockets/submit`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setStatus("pending_review");
      flashSuccess("Submitted for review ✓");
    } catch (err: unknown) {
      flashError(err instanceof Error ? err.message : "Submit failed");
    } finally { setIsSubmitting(false); }
  };

  // ── Upload ────────────────────────────────────────────────────────────────
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;
    if (mediaFiles.length >= 20) { flashError("Maximum 20 media files."); return; }

    setIsUploading(true);
    setUploadProgress(`Uploading ${file.name}…`);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res  = await fetch(`${BACKEND_URL}/api/pockets/media/upload`, {
        method: "POST", credentials: "include", body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setMediaFiles((p) => [...p, data as MediaFile]);
      flashSuccess(`${file.name} uploaded ✓`);
    } catch (err: unknown) {
      flashError(err instanceof Error ? err.message : "Upload failed");
    } finally { setIsUploading(false); setUploadProgress(null); }
  }, [mediaFiles.length, BACKEND_URL]);

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (s3Key: string) => {
    setDeletingKey(s3Key);
    try {
      const res = await fetch(`${BACKEND_URL}/api/pockets/media`, {
        method: "DELETE", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ s3Key }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      setMediaFiles((p) => p.filter((f) => f.s3Key !== s3Key));
    } catch (err: unknown) {
      flashError(err instanceof Error ? err.message : "Delete failed");
    } finally { setDeletingKey(null); }
  };

  // ── Insert snippet ────────────────────────────────────────────────────────
  const insertMediaSnippet = (file: MediaFile) => {
    const snippet = file.type === "video"
      ? `<video src="${file.url}" controls autoPlay loop muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />`
      : `<img src="${file.url}" alt="${file.name}" style={{ width: "100%", height: "100%", objectFit: "cover" }} />`;
    const savedPos = { ...lastCursorPos.current };
    setTab("code");
    let attempts = 0;
    const tryInsert = () => {
      if (textareaRef.current) {
        insertAtCursor(textareaRef, sourceCode, setSourceCode, snippet, savedPos);
      } else if (attempts++ < 20) {
        requestAnimationFrame(tryInsert);
      }
    };
    requestAnimationFrame(tryInsert);
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const previewSrc = `data:text/html;charset=utf-8,${encodeURIComponent(buildPreviewDoc(sourceCode, POCKET_HEIGHT))}`;
  const statusCfg  = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  const isDirty    = sourceCode !== savedSourceCode || status === "draft" || status === "rejected";
  const canSubmit  = !["pending_review"].includes(status) && !!brandName.trim() && !isSaving && !isSubmitting && (isDirty || status !== "live");
  const canSave    = !["pending_review"].includes(status) && !!brandName.trim() && !isSaving;
  const isLocked   = status === "pending_review";

  if (isLoading) {
    return (
      <div className="w-full max-w-3xl mx-auto h-64 bg-white dark:bg-[#191919] rounded-2xl border border-gray-200 dark:border-zinc-800 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto bg-white dark:bg-[#191919] min-h-[85vh] max-h-[95vh] rounded-2xl border border-gray-200 dark:border-zinc-800 flex flex-col overflow-hidden shadow-xl">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-zinc-800 bg-white/80 dark:bg-[#191919]/80 backdrop-blur-md sticky top-0 z-30">
        <div>
          <h2 className="text-xl font-bold text-black dark:text-white flex items-center gap-2">
            <Sparkles size={18} className="text-violet-500" />
            Sponsored Pocket
          </h2>
          <span className={`text-xs font-bold uppercase tracking-wider ${statusCfg.color}`}>
            {statusCfg.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSave} disabled={!canSave}
            className="px-4 py-2 rounded-full border border-gray-200 dark:border-zinc-700 text-sm font-bold text-gray-600 dark:text-zinc-300 hover:border-violet-500 hover:text-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition">
            {isSaving ? "Saving…" : "Save Draft"}
          </button>
          <button onClick={handleSubmit} disabled={!canSubmit}
            className="flex items-center gap-2 bg-violet-500 hover:bg-violet-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold px-5 py-2 rounded-full transition shadow-md shadow-violet-500/20">
            <Send size={14} />
            {isSubmitting ? "Submitting…" : "Submit for Review"}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">

        {/* Banners */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
            <AlertCircle size={15} className="flex-shrink-0" />{error}
          </div>
        )}
        {successMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10 flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={15} className="flex-shrink-0" />{successMsg}
          </div>
        )}
        {isLocked && (
          <div className={`mx-6 mt-4 p-3 rounded-xl border text-sm text-amber-700 dark:text-amber-400 ${statusCfg.bannerBg} ${statusCfg.bannerBorder}`}>
            Your pocket is under review. Edits are locked until a decision is made.
          </div>
        )}
        {status === "rejected" && reviewNote && (
          <div className={`mx-6 mt-4 p-3 rounded-xl border text-sm text-red-700 dark:text-red-400 ${statusCfg.bannerBg} ${statusCfg.bannerBorder}`}>
            <strong>Rejected:</strong> {reviewNote}
          </div>
        )}

        {/* Metadata */}
        <div className="px-6 pt-5 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-zinc-500 uppercase tracking-wider mb-1.5">
              Brand Name <span className="text-red-400">*</span>
            </label>
            <input placeholder="e.g. Acme Corp" value={brandName} onChange={(e) => setBrandName(e.target.value)} disabled={isLocked}
              className="w-full bg-gray-50 dark:bg-zinc-900 text-black dark:text-white p-3 rounded-xl border border-gray-200 dark:border-zinc-800 focus:ring-2 focus:ring-violet-500 outline-none text-sm disabled:opacity-50" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-zinc-500 uppercase tracking-wider mb-1.5">
              Tagline <span className="text-gray-400">(optional)</span>
            </label>
            <input placeholder="Shown in the feed above your pocket" value={tagline} onChange={(e) => setTagline(e.target.value)} disabled={isLocked}
              className="w-full bg-gray-50 dark:bg-zinc-900 text-black dark:text-white p-3 rounded-xl border border-gray-200 dark:border-zinc-800 focus:ring-2 focus:ring-violet-500 outline-none text-sm disabled:opacity-50" />
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-5">
          <div className="flex items-center border-b border-gray-100 dark:border-zinc-800 mb-3 gap-1">
            {(["code", "media", "preview"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold transition-all border-b-2 -mb-px ${
                  tab === t ? "border-violet-500 text-violet-500" : "border-transparent text-gray-500 dark:text-zinc-500 hover:text-black dark:hover:text-white"
                }`}>
                {t === "code"    && <Code2  size={14} />}
                {t === "media"   && <Images size={14} />}
                {t === "preview" && <Eye    size={14} />}
                {t === "code" ? "JSX Editor" : t === "media" ? `Media${mediaFiles.length > 0 ? ` (${mediaFiles.length})` : ""}` : "Preview"}
              </button>
            ))}
            {tab === "code" && (
              <span className={`ml-auto text-xs font-bold ${sourceCode.length > 55_000 ? "text-red-500" : "text-gray-400"}`}>
                {sourceCode.length.toLocaleString()} / 60,000
              </span>
            )}
          </div>

          {/* ── Code tab ──────────────────────────────────────────────────── */}
          {tab === "code" && (
            <textarea ref={textareaRef} value={sourceCode}
              onChange={(e) => { setSourceCode(e.target.value.slice(0, 60_000)); }}
              onKeyUp={(e)   => { const t = e.currentTarget; lastCursorPos.current = { start: t.selectionStart, end: t.selectionEnd }; }}
              onMouseUp={(e) => { const t = e.currentTarget; lastCursorPos.current = { start: t.selectionStart, end: t.selectionEnd }; }}
              onBlur={(e)    => { const t = e.currentTarget; lastCursorPos.current = { start: t.selectionStart, end: t.selectionEnd }; }}
              onKeyDown={handleKeyDown} spellCheck={false} disabled={isLocked}
              className="w-full min-h-[420px] bg-gray-950 dark:bg-black text-green-400 font-mono text-xs p-4 rounded-xl border border-gray-800 focus:ring-2 focus:ring-violet-500 outline-none resize-y leading-relaxed disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="// Write your PocketApp React component here"
            />
          )}

          {/* ── Media tab ─────────────────────────────────────────────────── */}
          {tab === "media" && (
            <div className="space-y-4 pb-2">
              <div
                onClick={() => !isLocked && !isUploading && fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed transition-all ${
                  isLocked || isUploading
                    ? "border-gray-200 dark:border-zinc-800 opacity-50 cursor-not-allowed"
                    : "border-violet-300 dark:border-violet-800 hover:border-violet-500 dark:hover:border-violet-600 hover:bg-violet-50/50 dark:hover:bg-violet-900/10 cursor-pointer"
                }`}>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml,video/mp4,video/webm" onChange={handleFileSelect} className="hidden" />
                {isUploading ? (
                  <>
                    <Loader2 size={28} className="text-violet-500 animate-spin" />
                    <p className="text-sm font-bold text-violet-500">{uploadProgress}</p>
                  </>
                ) : (
                  <>
                    <div className="flex gap-3 text-violet-400"><ImagePlus size={28} /><Film size={28} /></div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-black dark:text-white">Click to upload media</p>
                      <p className="text-xs text-gray-500 dark:text-zinc-500 mt-0.5">
                        JPG, PNG, GIF, WebP, SVG, MP4, WebM · Max 20 MB · {20 - mediaFiles.length} slots remaining
                      </p>
                    </div>
                  </>
                )}
              </div>

              {mediaFiles.length === 0 ? (
                <div className="text-center py-8 text-gray-400 dark:text-zinc-600 text-sm">
                  No media uploaded yet.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {mediaFiles.map((file) => (
                    <div key={file.s3Key} className="group relative rounded-xl overflow-hidden border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900">
                      {file.type === "image"
                        ? <img src={file.url} alt={file.name} className="w-full h-32 object-cover" loading="lazy" />
                        : <video src={file.url} className="w-full h-32 object-cover" muted preload="metadata" />
                      }
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                        <div className="flex justify-end gap-1">
                          <CopyButton text={file.url} />
                          <button onClick={() => handleDelete(file.s3Key)} disabled={!!deletingKey} title="Delete"
                            className="p-1.5 rounded-lg hover:bg-red-600 transition text-zinc-400 hover:text-white">
                            {deletingKey === file.s3Key ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                          </button>
                        </div>
                        <button onClick={() => insertMediaSnippet(file)} disabled={isLocked}
                          className="w-full text-[11px] font-bold bg-violet-500 hover:bg-violet-600 text-white rounded-lg py-1.5 transition disabled:opacity-50">
                          Insert into code
                        </button>
                      </div>
                      <div className="px-2 py-1.5 border-t border-gray-200 dark:border-zinc-800">
                        <p className="text-[10px] text-gray-500 dark:text-zinc-500 truncate">{file.name}</p>
                        <p className="text-[10px] text-gray-400 dark:text-zinc-600">{file.sizeMB} MB · {file.type}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="p-3 rounded-xl bg-violet-50 dark:bg-violet-900/10 border border-violet-100 dark:border-violet-800/50 text-xs text-violet-700 dark:text-violet-400 space-y-1">
                <p className="font-bold">How to use uploaded media:</p>
                <p>Hover any file → <strong>Insert into code</strong> pastes a JSX snippet at your cursor.</p>
                <p>Or hover → <strong>Copy URL</strong> and use it in a <code className="bg-violet-100 dark:bg-violet-900 px-1 rounded">src</code> attribute.</p>
              </div>
            </div>
          )}

          {/* ── Preview tab ───────────────────────────────────────────────── */}
          {tab === "preview" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-400 dark:text-zinc-600 font-mono px-1">
                <span>Preview — fixed {POCKET_HEIGHT}px canvas (matches feed)</span>
                <span className="text-[10px]">overflow: hidden</span>
              </div>
              <div
                className="w-full rounded-2xl overflow-hidden border-2 border-dashed border-violet-300 dark:border-violet-800"
                style={{ height: `${POCKET_HEIGHT}px` }}
              >
                <iframe
                  key={sourceCode}
                  title="pocket-preview"
                  src={previewSrc}
                  sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
                  referrerPolicy="no-referrer"
                  style={{
                    width:   "100%",
                    height:  `${POCKET_HEIGHT}px`,
                    border:  "none",
                    display: "block",
                  }}
                  loading="lazy"
                />
              </div>
              <p className="text-[10px] text-center text-gray-400 dark:text-zinc-600">
                The dashed border shows the exact space your pocket occupies in the feed. Nothing outside renders.
              </p>
            </div>
          )}
        </div>

        {/* Tips */}
        <div className="px-6 pt-5 pb-8">
          <button onClick={() => setShowTips(!showTips)}
            className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-zinc-500 hover:text-black dark:hover:text-white transition">
            <Info size={13} />
            How Pockets work
            {showTips ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {showTips && (
            <div className="mt-3 space-y-3 text-xs leading-relaxed">

              {/* ── Critical requirements — things that will break the pocket ── */}
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800">
                <p className="font-black text-red-600 dark:text-red-400 uppercase tracking-wider mb-2">
                  🚨 Required — preview &amp; live will break without these
                </p>
                <div className="space-y-2 text-red-700 dark:text-red-300">
                  <p>
                    <strong>1. Component must be named exactly <code className="bg-red-100 dark:bg-red-900 px-1.5 py-0.5 rounded font-mono">PocketApp</code></strong><br/>
                    <span className="opacity-70">The sandbox looks for <code className="font-mono">window.PocketApp</code> by name. Any other name and nothing renders.</span>
                  </p>
                  <p>
                    <strong>2. Use <code className="bg-red-100 dark:bg-red-900 px-1.5 py-0.5 rounded font-mono">React.useState</code>, <code className="bg-red-100 dark:bg-red-900 px-1.5 py-0.5 rounded font-mono">React.useEffect</code>, etc. — not destructured imports</strong><br/>
                    <span className="opacity-70">There are no imports in the sandbox. React is available as the global <code className="font-mono">React</code> object only.</span>
                  </p>
                  <p>
                    <strong>3. No <code className="bg-red-100 dark:bg-red-900 px-1.5 py-0.5 rounded font-mono">import</code> or <code className="bg-red-100 dark:bg-red-900 px-1.5 py-0.5 rounded font-mono">export</code> statements</strong><br/>
                    <span className="opacity-70">The sandbox runs your code as a plain script, not a module. Any import/export will cause a syntax error.</span>
                  </p>
                  <p>
                    <strong>4. Inline styles only — no Tailwind, no CSS classes</strong><br/>
                    <span className="opacity-70">The sandbox has no stylesheet. Use <code className="font-mono">{"style={{ color: 'red' }}"}</code> on every element.</span>
                  </p>
                  <p>
                    <strong>5. Fixed {POCKET_HEIGHT}px height — nothing outside renders</strong><br/>
                    <span className="opacity-70">The canvas is hard-clipped at {POCKET_HEIGHT}px tall. Set <code className="font-mono">{"height: '100%'"}</code> on your root element and design within this space.</span>
                  </p>
                </div>
              </div>

              {/* ── What's available ── */}
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800">
                <p className="font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-2">✅ What you can use</p>
                <div className="space-y-1.5 text-emerald-800 dark:text-emerald-300">
                  <p><code className="bg-emerald-100 dark:bg-emerald-900 px-1 rounded font-mono">React.useState / useEffect / useRef / useMemo / useCallback</code> — all hooks via the global <code className="font-mono">React</code> object</p>
                  <p>Inline styles — <code className="bg-emerald-100 dark:bg-emerald-900 px-1 rounded font-mono">{"style={{ color: '#fff', fontSize: 14 }}"}</code></p>
                  <p>Images &amp; videos uploaded via the <strong>Media tab</strong> — paste URLs directly into <code className="font-mono">src</code> props</p>
                  <p>External <code className="font-mono">https://</code> images and videos</p>
                  <p>SVG inline or via <code className="font-mono">&lt;img src="https://...svg"/&gt;</code></p>
                  <p>setTimeout / setInterval / requestAnimationFrame</p>
                  <p>Math, Date, JSON — all standard JS globals</p>
                </div>
              </div>

              {/* ── What's blocked ── */}
              <div className="p-4 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
                <p className="font-black text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-2">❌ What is blocked</p>
                <div className="space-y-1.5 text-zinc-600 dark:text-zinc-400">
                  <p><code className="bg-zinc-200 dark:bg-zinc-800 px-1 rounded font-mono">fetch()</code> / XHR / WebSocket — all network calls are blocked by CSP</p>
                  <p><code className="bg-zinc-200 dark:bg-zinc-800 px-1 rounded font-mono">localStorage</code> / <code className="bg-zinc-200 dark:bg-zinc-800 px-1 rounded font-mono">sessionStorage</code> / cookies — sandbox isolation</p>
                  <p>Third-party libraries (lodash, axios, etc.) — no CDN access inside the sandbox</p>
                  <p>Tailwind / CSS modules / any stylesheet</p>
                  <p><code className="bg-zinc-200 dark:bg-zinc-800 px-1 rounded font-mono">document.cookie</code> / <code className="bg-zinc-200 dark:bg-zinc-800 px-1 rounded font-mono">window.location</code> navigation</p>
                </div>
              </div>

              {/* ── Quick reference ── */}
              <div className="p-4 rounded-xl bg-violet-50 dark:bg-violet-900/10 border border-violet-200 dark:border-violet-800">
                <p className="font-black text-violet-700 dark:text-violet-400 uppercase tracking-wider mb-2">💡 Quick-start template</p>
                <pre className="text-violet-800 dark:text-violet-300 font-mono text-[10px] leading-relaxed whitespace-pre-wrap bg-violet-100 dark:bg-violet-900/30 p-3 rounded-lg">{`const PocketApp = () => {
  const [count, setCount] = React.useState(0);

  return (
    <div style={{ width: "100%", height: "100%",
                  display: "flex", alignItems: "center",
                  justifyContent: "center",
                  background: "#0f0f0f", color: "#fff" }}>
      <button
        onClick={() => setCount(c => c + 1)}
        style={{ padding: "12px 28px", borderRadius: 8,
                 background: "#7c3aed", color: "#fff",
                 border: "none", cursor: "pointer",
                 fontSize: 16, fontWeight: 700 }}>
        Clicked {count} times
      </button>
    </div>
  );
};`}</pre>
              </div>

              <p className="text-amber-500 text-center">⚠ Every submission goes through admin review before going live.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PocketEditor;