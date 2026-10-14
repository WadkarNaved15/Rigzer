// src/components/postModal/ActivePostForm/PocketEditor.tsx
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Code2, Eye, Sparkles, Info, Send,
  ChevronDown, ChevronUp, AlertCircle, CheckCircle2,
  ImagePlus, Film, Trash2, Copy, Check, Loader2, Images, Upload,
} from "lucide-react";
import type { PocketEditorProps } from "../../../types/Post";
import { useNavigate } from "react-router-dom";

// ─── Types ────────────────────────────────────────────────────────────────────
interface MediaFile {
  s3Key:  string;
  url:    string;
  sizeMB: number;
  type:   "image" | "video";
  name:   string;
}

interface UploadingFile {
  id:       string;  // temp id for tracking
  name:     string;
  progress: "uploading" | "done" | "error";
  error?:   string;
}

interface Pocket {
  _id: string;
  brandName: string;
  tagline?: string;
  sourceCode?: string;
  status: string;
  reviewNote?: string | null;
}

const POCKET_HEIGHT = 550;
const MAX_MEDIA     = 20;
const ACCEPTED      = "image/jpeg,image/png,image/gif,image/webp,image/svg+xml,video/mp4,video/webm";

// ─── Starter template ─────────────────────────────────────────────────────────
const STARTER_CODE = `
// Pure inline styles — no Tailwind needed.
// Fixed 550px canvas height. Design within this space.

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
      width: "100%", height: "550px", background: BG, overflow: "hidden",
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
    dot: (on) => ({
      width: 7, height: 7, borderRadius: "50%", transition: "all 0.7s",
      background: on ? GREEN : "rgba(118,185,0,0.22)",
      boxShadow: on ? ("0 0 10px " + GREEN) : "none",
    }),
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
      <div style={s.header}>
        <div style={s.headerLeft}>
          <span style={s.nvidiaTag}>NVIDIA</span>
          <span style={s.partnerLabel}>× Rigzer Cloud Gaming</span>
        </div>
      </div>
      <div style={s.tabRow}>
        {tabs.map(t => (
          <button key={t.id} style={s.tab(tab === t.id)} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div style={s.body}>
        <h2 style={s.headline}>{p.headline}</h2>
        <p style={s.sub}>{p.sub}</p>
        <div style={s.cards}>
          {p.cards.map((card, i) => (
            <div key={i} style={s.card(hovered === i)}
              onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
              <div style={s.cardIcon}>{card.icon}</div>
              <div style={s.cardTitle(hovered === i)}>{card.title}</div>
              <div style={s.cardDesc}>{card.desc}</div>
            </div>
          ))}
        </div>
        <div style={s.ctaRow}>
          <a href={p.url} target="_blank" rel="noopener noreferrer" style={s.cta}
            onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
            onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
            {p.cta}
          </a>
          <span style={s.poweredBy}>Powered by NVIDIA RTX Infrastructure</span>
        </div>
      </div>
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


function buildPreviewDoc(jsx: string, height: number): string {
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
    html, body { width: 100%; height: ${height}px; margin: 0; overflow: hidden; background: transparent; }
    #root { width: 100%; height: ${height}px; overflow: hidden; }
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

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bannerBg?: string; bannerBorder?: string }> = {
  draft:          { label: "Draft",     color: "text-gray-400" },
  pending_review: { label: "In Review", color: "text-amber-500", bannerBg: "bg-amber-50 dark:bg-amber-900/10",  bannerBorder: "border-amber-200 dark:border-amber-800" },
  rejected:       { label: "Rejected",  color: "text-red-500",   bannerBg: "bg-red-50 dark:bg-red-900/10",      bannerBorder: "border-red-200 dark:border-red-800" },
  live:           { label: "Live ✓",    color: "text-[#3D7A6E]" },
};

// ─── CopyButton ───────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); }}
      title="Copy URL" className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-white/[0.1] transition text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white">
      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
    </button>
  );
}

// ─── Insert snippet at textarea cursor ───────────────────────────────────────
function insertAtCursor(
  ref: React.RefObject<HTMLTextAreaElement | null>,
  code: string, setCode: (v: string) => void,
  snippet: string, savedPos?: { start: number; end: number }
) {
  const ta = ref.current;
  if (!ta) {
    setCode(code + "\n" + snippet);
    return;
  }

  const s = savedPos?.start ?? ta.selectionStart;
  const e = savedPos?.end ?? ta.selectionEnd;
  const next = code.slice(0, s) + snippet + code.slice(e);

  setCode(next);
  requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = s + snippet.length; ta.focus(); });
}

// ─── Component ────────────────────────────────────────────────────────────────
const PocketEditor: React.FC<PocketEditorProps> = ({ onCancel: _onCancel }) => {
  const [tab, setTab]                   = useState<"code" | "media" | "preview">("code");
  const [brandName, setBrandName]       = useState("");
  const [tagline, setTagline]           = useState("");
  const [sourceCode, setSourceCode]     = useState(STARTER_CODE);
  const [savedSourceCode, setSavedSourceCode] = useState(STARTER_CODE);
  const [status, setStatus]             = useState("draft");
  const [reviewNote, setReviewNote]     = useState<string | null>(null);
  const [isSaving, setIsSaving]         = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading]       = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [successMsg, setSuccessMsg]     = useState<string | null>(null);
  const [showTips, setShowTips]         = useState(false);

  const [pockets, setPockets] = useState<Pocket[]>([]);
  const [selectedPocketId, setSelectedPocketId] = useState<string | null>(null);
  const [isCreatingPocket, setIsCreatingPocket] = useState(false);
  const [isSwitchingPocket, setIsSwitchingPocket] = useState(false);

  // Media
  const [mediaFiles, setMediaFiles]       = useState<MediaFile[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isDragging, setIsDragging]       = useState(false);
  const [deletingKey, setDeletingKey]     = useState<string | null>(null);

  const textareaRef   = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const previewIframeRef = useRef<HTMLIFrameElement | null>(null);
  const lastCursorPos = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
  const dragCounter   = useRef(0);
  const BACKEND_URL   = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

  const navigate = useNavigate();


useEffect(() => {
  const handlePocketNavigation = (event: MessageEvent) => {
    // Only accept messages from this editor's preview iframe.
    if (event.source !== previewIframeRef.current?.contentWindow) {
      return;
    }

    const data = event.data;

    if (!data || data.type !== "RIGZER_NAVIGATE") return;
    if (typeof data.path !== "string") return;

    // Only allow same-origin internal URLs.
    let target: URL;

    try {
      target = new URL(data.path, window.location.origin);
    } catch {
      return;
    }

    if (target.origin !== window.location.origin) return;
    if (!data.path.startsWith("/") || data.path.startsWith("//")) return;
    if (data.path.includes("\\")) return;

    navigate(target.pathname + target.search + target.hash);
  };

  window.addEventListener("message", handlePocketNavigation);

  return () => {
    window.removeEventListener("message", handlePocketNavigation);
  };
}, [navigate]);


const loadPocket = useCallback(
  async (pocketId: string | null) => {
    setIsSwitchingPocket(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (!pocketId) {
        // A new, unsaved Pocket.
        setSelectedPocketId(null);
        setIsCreatingPocket(true);

        setBrandName("");
        setTagline("");
        setSourceCode(STARTER_CODE);
        setSavedSourceCode(STARTER_CODE);
        setStatus("draft");
        setReviewNote(null);
        setMediaFiles([]);
        setUploadingFiles([]);

        return;
      }

      const [pocketRes, mediaRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/pockets/${pocketId}`, {
          credentials: "include",
        }),
        fetch(`${BACKEND_URL}/api/pockets/${pocketId}/media`, {
          credentials: "include",
        }),
      ]);

      const pocketData = await pocketRes.json();

      if (!pocketRes.ok) {
        throw new Error(pocketData.message || "Failed to load Pocket");
      }

      const pocket: Pocket = pocketData.pocket;

      if (!pocket?._id) {
        throw new Error("Pocket not found");
      }

      const mediaData = mediaRes.ok ? await mediaRes.json() : null;

      setSelectedPocketId(pocket._id);
      setIsCreatingPocket(false);

      setBrandName(pocket.brandName ?? "");
      setTagline(pocket.tagline ?? "");
      setStatus(pocket.status ?? "draft");
      setReviewNote(pocket.reviewNote ?? null);

      const code = pocket.sourceCode || STARTER_CODE;
      setSourceCode(code);
      setSavedSourceCode(code);

      setMediaFiles(mediaData?.files ?? []);
      setUploadingFiles([]);
      setDeletingKey(null);
      setTab("code");
    } catch (err: unknown) {
      flashError(
        err instanceof Error ? err.message : "Failed to load Pocket"
      );
    } finally {
      setIsSwitchingPocket(false);
    }
  },
  [BACKEND_URL]
);

const loadPockets = useCallback(async () => {
  setIsLoading(true);

  try {
    const res = await fetch(`${BACKEND_URL}/api/pockets/mine`, {
      credentials: "include",
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Failed to load Pockets");
    }

    const list: Pocket[] = data.pockets ?? [];
    setPockets(list);

    if (list.length > 0) {
      await loadPocket(list[0]._id);
    } else {
      await loadPocket(null);
    }
  } catch (err: unknown) {
    flashError(
      err instanceof Error ? err.message : "Failed to load Pockets"
    );
  } finally {
    setIsLoading(false);
  }
}, [BACKEND_URL, loadPocket]);

useEffect(() => {
  void loadPockets();
}, [loadPockets]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const ta = textareaRef.current!;
    const s  = ta.selectionStart;
    const end = ta.selectionEnd;
    setSourceCode(sourceCode.slice(0, s) + "  " + sourceCode.slice(end));
    requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = s + 2; });
  };

  const flashSuccess = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(null), 3500); };
  const flashError   = (msg: string) => { setError(msg);      setTimeout(() => setError(null), 5000); };

  // ── Save ──────────────────────────────────────────────────────────────────
const handleSave = async (): Promise<string | null> => {
  if (
    isSaving ||
    !brandName.trim() ||
    status === "pending_review"
  ) {
    return null;
  }

  setIsSaving(true);

  try {
    const isNew = !selectedPocketId;

    const url = isNew
      ? `${BACKEND_URL}/api/pockets`
      : `${BACKEND_URL}/api/pockets/${selectedPocketId}`;

    const res = await fetch(url, {
      method: isNew ? "POST" : "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandName, tagline, sourceCode }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Save failed");
    }

    const pocket: Pocket = data.pocket;

    if (!pocket?._id) {
      throw new Error("The server did not return the saved Pocket");
    }

    setSelectedPocketId(pocket._id);
    setIsCreatingPocket(false);
    setStatus(pocket.status);
    setReviewNote(pocket.reviewNote ?? null);
    setSavedSourceCode(sourceCode);

    setPockets((prev) => {
      const withoutSaved = prev.filter((p) => p._id !== pocket._id);
      return [pocket, ...withoutSaved];
    });

    flashSuccess(isNew ? "Pocket created ✓" : "Draft saved ✓");
     return pocket._id;
  } catch (err: unknown) {
    flashError(err instanceof Error ? err.message : "Save failed");
    return null;
  } finally {
    setIsSaving(false);
  }
};


  // ── Submit ────────────────────────────────────────────────────────────────
const handleSubmit = async () => {
  if (isSubmitting || isSwitchingPocket) return;

  const pocketId = await handleSave();
  if (!pocketId) return;

  setIsSubmitting(true);

  try {
    const res = await fetch(
      `${BACKEND_URL}/api/pockets/${pocketId}/submit`,
      {
        method: "POST",
        credentials: "include",
      }
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || "Submit failed");
    }

    setStatus(data.pocket.status);

    setPockets((prev) =>
      prev.map((p) =>
        p._id === pocketId
          ? { ...p, status: data.pocket.status }
          : p
      )
    );

    flashSuccess("Submitted for review ✓");
  } catch (err: unknown) {
    flashError(
      err instanceof Error ? err.message : "Submit failed"
    );
  } finally {
    setIsSubmitting(false);
  }
};

  // ── Upload (multi-file) ───────────────────────────────────────────────────
  const uploadFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
      if (!selectedPocketId) {
        flashError("Save the Pocket before uploading media.");
        return;
      }

    const slotsLeft = MAX_MEDIA - mediaFiles.length;
    const toUpload  = files.slice(0, slotsLeft);
    if (toUpload.length < files.length) {
      flashError(`Only ${slotsLeft} slot${slotsLeft === 1 ? "" : "s"} remaining — ${files.length - toUpload.length} file(s) skipped.`);
    }
    if (!toUpload.length) return;

    // Show per-file progress rows
    const pending: UploadingFile[] = toUpload.map(f => ({ id: crypto.randomUUID(), name: f.name, progress: "uploading" }));
    setUploadingFiles(prev => [...prev, ...pending]);

    const fd = new FormData();
    toUpload.forEach(f => fd.append("files", f));

    try {
      const res = await fetch(
        `${BACKEND_URL}/api/pockets/${selectedPocketId}/media/upload`,
        {
          method: "POST",
          credentials: "include",
          body: fd,
        }
      );
      const data = await res.json();

      if (!res.ok) throw new Error(data.message ?? "Upload failed");

      // data = { uploaded: MediaFile[], errors: [{name, error}] }
      const uploaded: MediaFile[] = data.uploaded ?? [];
      const errors: { name: string; error: string }[] = data.errors ?? [];

      setMediaFiles(prev => [...prev, ...uploaded]);

      // Mark rows done/error
      setUploadingFiles(prev =>
        prev.map(row => {
          const matchPending = pending.find(p => p.id === row.id);
          if (!matchPending) return row;
          const errEntry = errors.find(e => e.name === matchPending.name);
          return { ...row, progress: errEntry ? "error" : "done", error: errEntry?.error };
        })
      );

      // Clear done rows after 2s
      setTimeout(() => {
        setUploadingFiles(prev => prev.filter(r => r.progress !== "done"));
      }, 2000);

      if (uploaded.length) flashSuccess(`${uploaded.length} file${uploaded.length > 1 ? "s" : ""} uploaded ✓`);
      if (errors.length)   flashError(`${errors.length} file${errors.length > 1 ? "s" : ""} failed: ${errors.map(e => e.name).join(", ")}`);
    } catch (err: unknown) {
      setUploadingFiles(prev => prev.map(r =>
        pending.find(p => p.id === r.id) ? { ...r, progress: "error", error: err instanceof Error ? err.message : "Upload failed" } : r
      ));
      flashError(err instanceof Error ? err.message : "Upload failed");
    }
}, [mediaFiles.length, BACKEND_URL, selectedPocketId]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (fileInputRef.current) fileInputRef.current.value = "";
    uploadFiles(files);
  }, [uploadFiles]);

  // ── Drag & drop ───────────────────────────────────────────────────────────
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  };
  const handleDragOver  = (e: React.DragEvent) => e.preventDefault();
  const handleDrop      = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    uploadFiles(files);
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (s3Key: string) => {
    setDeletingKey(s3Key);
    try {
      if (!selectedPocketId) {
        flashError("Select a Pocket before deleting media.");
        return;
      }

      const res = await fetch(
        `${BACKEND_URL}/api/pockets/${selectedPocketId}/media`,
        {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ s3Key }),
        }
      );
      if (!res.ok) throw new Error((await res.json()).message);
      setMediaFiles(prev => prev.filter(f => f.s3Key !== s3Key));
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
      if (textareaRef.current) insertAtCursor(textareaRef, sourceCode, setSourceCode, snippet, savedPos);
      else if (attempts++ < 20) requestAnimationFrame(tryInsert);
    };
    requestAnimationFrame(tryInsert);
  };

  // ── Derived ───────────────────────────────────────────────────────────────
const previewHtml = buildPreviewDoc(sourceCode, POCKET_HEIGHT);
  const statusCfg   = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  const isDirty     = sourceCode !== savedSourceCode || status === "draft" || status === "rejected";
  const canSubmit   = !["pending_review"].includes(status) && !!brandName.trim() && !isSaving && !isSubmitting && (isDirty || status !== "live");
  const canSave     = !["pending_review"].includes(status) && !!brandName.trim() && !isSaving;
  const isLocked    = status === "pending_review";
  const slotsLeft   = MAX_MEDIA - mediaFiles.length;
  const isUploading = uploadingFiles.some(f => f.progress === "uploading");

  if (isLoading) {
    return (
      <div className="w-full max-w-3xl mx-auto h-64 bg-white dark:bg-black/20 backdrop-blur-2xl rounded-3xl border border-gray-200 dark:border-white/[0.06] flex items-center justify-center shadow-2xl">
        <div className="w-6 h-6 border-2 border-[#3D7A6E] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }


  return (
    <div className="w-full max-w-3xl mx-auto bg-white dark:bg-black/20 backdrop-blur-2xl min-h-[85vh] max-h-[95vh] rounded-3xl border border-gray-200 dark:border-white/[0.06] flex flex-col overflow-hidden shadow-2xl">

      {/* Header */}
      <div className="relative z-30 border-b border-gray-200/70 dark:border-white/[0.07] bg-white/80 dark:bg-[#0b0c0d]/90 backdrop-blur-xl">

        {/* Title row */}
        <div className="flex items-center justify-between gap-4 px-5 sm:px-7 pt-5 pb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#3D7A6E]/10 border border-[#3D7A6E]/20">
                <Sparkles size={17} className="text-[#3D7A6E]" />
              </div>

              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-gray-950 dark:text-white">
                  Sponsored Pocket
                </h2>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  Create and manage your sponsored content
                </p>
              </div>
            </div>
          </div>

          <span
            className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border ${
              status === "live"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                : status === "pending_review"
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                : status === "rejected"
                ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                : "bg-gray-100 dark:bg-white/[0.05] text-gray-500 dark:text-gray-400 border-gray-200 dark:border-white/[0.08]"
            }`}
          >
            {statusCfg.label}
          </span>
        </div>

        {/* Pocket selector and actions */}
        <div className="flex flex-col gap-3 px-5 sm:px-7 pb-5 lg:flex-row lg:items-center lg:justify-between">

          {/* Pocket management */}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="relative min-w-0 flex-1 sm:max-w-xs">
              <select
                value={selectedPocketId ?? ""}
                disabled={isSwitchingPocket || isSaving || isSubmitting}
                onChange={(e) => {
                  void loadPocket(e.target.value || null);
                }}
                className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 pr-9 text-sm font-medium text-gray-800 outline-none transition focus:border-[#3D7A6E] focus:ring-2 focus:ring-[#3D7A6E]/15 dark:border-white/[0.09] dark:bg-white/[0.035] dark:text-gray-100 disabled:opacity-50"
              >
                {pockets.map((pocket) => (
                  <option key={pocket._id} value={pocket._id}>
                    {pocket.brandName || "Untitled Pocket"} · {pocket.status.replace("_", " ")}
                  </option>
                ))}

                {pockets.length === 0 && (
                  <option value="">No Pockets yet</option>
                )}
              </select>

              <ChevronDown
                size={15}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
            </div>

            <button
              type="button"
              disabled={isSaving || isSubmitting || isSwitchingPocket}
              onClick={() => void loadPocket(null)}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[#3D7A6E]/30 bg-[#3D7A6E]/[0.06] px-3.5 py-2.5 text-sm font-semibold text-[#3D7A6E] transition hover:border-[#3D7A6E]/60 hover:bg-[#3D7A6E]/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="text-lg leading-none">+</span>
              <span>New</span>
            </button>
          </div>

          {/* Primary actions */}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!canSave || isSwitchingPocket}
              className="inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-[#3D7A6E]/50 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/[0.1] dark:bg-white/[0.035] dark:text-gray-200 dark:hover:bg-white/[0.07]"
            >
              {isSaving ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Check size={15} />
              )}
              {isSaving ? "Saving…" : "Save Draft"}
            </button>

            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!canSubmit || isSwitchingPocket}
              className="inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-[#3D7A6E] px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-[#3D7A6E]/20 transition hover:bg-[#32665b] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSubmitting ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              {isSubmitting ? "Submitting…" : "Submit for Review"}
            </button>
          </div>
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
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
              Brand Name <span className="text-red-400">*</span>
            </label>
            <input placeholder="e.g. Acme Corp" value={brandName} onChange={e => setBrandName(e.target.value)} disabled={isLocked}
              className="w-full bg-gray-50 dark:bg-white/[0.02] text-black dark:text-white p-3 rounded-xl border border-gray-200 dark:border-white/[0.1] focus:border-[#3D7A6E] focus:ring-1 focus:ring-[#3D7A6E] outline-none text-sm transition-all disabled:opacity-50" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">
              Tagline <span className="text-gray-400 dark:text-gray-500">(optional)</span>
            </label>
            <input placeholder="Shown in the feed above your pocket" value={tagline} onChange={e => setTagline(e.target.value)} disabled={isLocked}
              className="w-full bg-gray-50 dark:bg-white/[0.02] text-black dark:text-white p-3 rounded-xl border border-gray-200 dark:border-white/[0.1] focus:border-[#3D7A6E] focus:ring-1 focus:ring-[#3D7A6E] outline-none text-sm transition-all disabled:opacity-50" />
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-5">
          <div className="flex items-center border-b border-gray-100 dark:border-white/[0.06] mb-3 gap-1">
            {(["code", "media", "preview"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold transition-all border-b-2 -mb-px ${
                  tab === t ? "border-[#3D7A6E] text-[#3D7A6E]" : "border-transparent text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white"
                }`}>
                {t === "code"    && <Code2  size={14} />}
                {t === "media"   && <Images size={14} />}
                {t === "preview" && <Eye    size={14} />}
                {t === "code" ? "HTML / JSX Editor" : t === "media" ? `Media${mediaFiles.length > 0 ? ` (${mediaFiles.length})` : ""}` : "Preview"}
              </button>
            ))}
            {/* {tab === "code" && (
              <span className={`ml-auto text-xs font-bold ${sourceCode.length > 55_000 ? "text-red-500" : "text-gray-400"}`}>
                {sourceCode.length.toLocaleString()} / 60,000
              </span>
            )} */}
          </div>

          {/* ── Code tab ──────────────────────────────────────────────────── */}
          {tab === "code" && (
            <textarea ref={textareaRef} value={sourceCode}
              onChange={e => setSourceCode(e.target.value)}
              onKeyUp={e   => { const t = e.currentTarget; lastCursorPos.current = { start: t.selectionStart, end: t.selectionEnd }; }}
              onMouseUp={e => { const t = e.currentTarget; lastCursorPos.current = { start: t.selectionStart, end: t.selectionEnd }; }}
              onBlur={e    => { const t = e.currentTarget; lastCursorPos.current = { start: t.selectionStart, end: t.selectionEnd }; }}
              onKeyDown={handleKeyDown} spellCheck={false} disabled={isLocked}
              className="w-full min-h-[420px] bg-gray-950 dark:bg-black/40 text-green-400 font-mono text-xs p-4 rounded-xl border border-gray-200 dark:border-white/[0.06] focus:border-[#3D7A6E] focus:ring-1 focus:ring-[#3D7A6E] outline-none resize-y leading-relaxed disabled:opacity-50 disabled:cursor-not-allowed shadow-inner"
              placeholder="Paste a complete HTML document or write a PocketApp React JSX component here"
            />
          )}

          {/* ── Media tab ─────────────────────────────────────────────────── */}
          {tab === "media" && (
            <div className="space-y-4 pb-2">
              {!selectedPocketId && (
                <p className="text-sm text-amber-600">
                  Save this Pocket first to upload media.
                </p>
              )}

              {/* Drop zone */}
              <div
                onDragEnter={!isLocked ? handleDragEnter : undefined}
                onDragLeave={!isLocked ? handleDragLeave : undefined}
                onDragOver={!isLocked ? handleDragOver : undefined}
                onDrop={!isLocked ? handleDrop : undefined}
                onClick={() => !isLocked && !isUploading && fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 transition-all ${
                  isLocked
                    ? "border-gray-200 dark:border-white/[0.1] opacity-50 cursor-not-allowed"
                    : isDragging
                    ? "border-solid border-[#3D7A6E] bg-[#3D7A6E]/10 dark:bg-[#3D7A6E]/20 scale-[1.01] cursor-copy"
                    : isUploading
                    ? "border-solid border-[#3D7A6E]/40 dark:border-[#3D7A6E]/60 cursor-wait"
                    : "border-dashed border-gray-300 dark:border-white/[0.1] hover:border-[#3D7A6E] dark:hover:border-[#4A9384] hover:bg-gray-50 dark:hover:bg-white/[0.02] cursor-pointer"
                }`}>
                <input ref={fileInputRef} type="file" accept={ACCEPTED} multiple onChange={handleFileInputChange} className="hidden" />

                {isDragging ? (
                  <>
                    <Upload size={32} className="text-[#3D7A6E]" />
                    <p className="text-sm font-bold text-[#3D7A6E]">Drop files here</p>
                  </>
                ) : isUploading ? (
                  <>
                    <Loader2 size={28} className="text-[#3D7A6E] animate-spin" />
                    <p className="text-sm font-bold text-[#3D7A6E]">
                      Uploading {uploadingFiles.filter(f => f.progress === "uploading").length} file(s)…
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex gap-3 text-[#4A9384]"><ImagePlus size={28} /><Film size={28} /></div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-black dark:text-white">
                        Click to upload or drag & drop
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        JPG, PNG, GIF, WebP, SVG, MP4, WebM · Max 30 MB each · {slotsLeft} slot{slotsLeft !== 1 ? "s" : ""} remaining
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* In-progress rows */}
              {uploadingFiles.length > 0 && (
                <div className="space-y-1.5">
                  {uploadingFiles.map(f => (
                    <div key={f.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
                      f.progress === "error"
                        ? "bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400"
                        : f.progress === "done"
                        ? "bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-[#3D7A6E]/10 dark:bg-[#3D7A6E]/20 text-[#3D7A6E] dark:text-[#4A9384]"
                    }`}>
                      {f.progress === "uploading" && <Loader2 size={12} className="animate-spin flex-shrink-0" />}
                      {f.progress === "done"      && <CheckCircle2 size={12} className="flex-shrink-0" />}
                      {f.progress === "error"     && <AlertCircle  size={12} className="flex-shrink-0" />}
                      <span className="truncate flex-1">{f.name}</span>
                      {f.error && <span className="opacity-70">{f.error}</span>}
                    </div>
                  ))}
                </div>
              )}

              {/* Grid */}
              {mediaFiles.length === 0 ? (
                <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">No media uploaded yet.</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {mediaFiles.map(file => (
                    <div key={file.s3Key} className="group relative rounded-xl overflow-hidden border border-gray-200 dark:border-white/[0.06] bg-gray-50 dark:bg-white/[0.04]">
                      {file.type === "image"
                        ? <img src={file.url} alt={file.name} className="w-full h-32 object-cover" loading="lazy" />
                        : <video src={file.url} className="w-full h-32 object-cover" muted preload="metadata" />
                      }
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                        <div className="flex justify-end gap-1">
                          <CopyButton text={file.url} />
                          <button onClick={() => handleDelete(file.s3Key)} disabled={!!deletingKey} title="Delete"
                            className="p-1.5 rounded-lg hover:bg-red-600 transition text-gray-400 hover:text-white">
                            {deletingKey === file.s3Key ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                          </button>
                        </div>
                        <button onClick={() => insertMediaSnippet(file)} disabled={isLocked}
                          className="w-full text-[11px] font-bold bg-[#3D7A6E] hover:bg-[#2F5E55] text-white rounded-lg py-1.5 transition disabled:opacity-50">
                          Insert into code
                        </button>
                      </div>
                      <div className="px-2 py-1.5 border-t border-gray-200 dark:border-white/[0.06]">
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{file.name}</p>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500">{file.sizeMB} MB · {file.type}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="p-3 rounded-xl bg-[#3D7A6E]/10 dark:bg-[#3D7A6E]/20 border border-[#3D7A6E]/20 dark:border-[#3D7A6E]/40 text-xs text-[#2F5E55] dark:text-[#4A9384] space-y-1">
                <p className="font-bold">How to use uploaded media:</p>
                <p>Hover any file → <strong>Insert into code</strong> pastes a JSX snippet at your cursor.</p>
                <p>Or hover → <strong>Copy URL</strong> and use it in a <code className="bg-[#3D7A6E]/20 dark:bg-[#3D7A6E]/30 px-1 rounded">src</code> attribute.</p>
              </div>
            </div>
          )}

          {/* ── Preview tab ───────────────────────────────────────────────── */}
          {tab === "preview" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 font-mono px-1">
                <span>Preview — fixed {POCKET_HEIGHT}px canvas (matches feed)</span>
                <span className="text-[10px]">overflow: hidden</span>
              </div>
              <div className="w-full rounded-2xl overflow-hidden border-2 border-dashed border-[#3D7A6E]/40 dark:border-[#3D7A6E]/60" style={{ height: `${POCKET_HEIGHT}px` }}>

              <iframe
                key={sourceCode}
                ref={previewIframeRef}
                title="pocket-preview"
                srcDoc={previewHtml}
                sandbox="allow-scripts allow-popups"
                referrerPolicy="no-referrer"
                style={{
                  width: "100%",
                  height: `${POCKET_HEIGHT}px`,
                  border: "none",
                  display: "block",
                }}
              />

              </div>
              <p className="text-[10px] text-center text-gray-400 dark:text-gray-500">
                The dashed border shows the exact space your pocket occupies in the feed.
              </p>
            </div>
          )}
        </div>

        {/* Tips */}
        <div className="px-6 pt-5 pb-8">
          <button onClick={() => setShowTips(!showTips)}
            className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white transition">
            <Info size={13} />
            How Pockets work
            {showTips ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {showTips && (
            <div className="mt-3 space-y-3 text-xs leading-relaxed">
              <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
                <p className="font-black text-blue-700 dark:text-blue-400 uppercase tracking-wider mb-2">
                  HTML & React JSX are supported
                </p>

                <div className="space-y-2 text-blue-800 dark:text-blue-300">
                  <p>
                    <strong>1. Standalone HTML</strong><br />
                    <span className="opacity-80">
                      Paste a complete HTML document containing HTML, CSS, and inline JavaScript.
                      You do not need to declare PocketApp or use React in HTML mode.
                    </span>
                  </p>

                  <p>
                    <strong>2. React JSX</strong><br />
                    <span className="opacity-80">
                      Declare your component as <code className="font-mono">const PocketApp = () =&gt; ...</code>.
                      React is available through the global <code className="font-mono">React</code> object.
                      Do not use import or export statements.
                    </span>
                  </p>

                  <p>
                    <strong>3. Fixed canvas height</strong><br />
                    <span className="opacity-80">
                      The preview is {POCKET_HEIGHT}px tall with overflow clipped.
                      Design your content to fit this area.
                    </span>
                  </p>

                  <p>
                    <strong>4. Sandbox restrictions</strong><br />
                    <span className="opacity-80">
                      HTML runs in a sandboxed iframe. Network requests, embedded frames,
                      plugins, and external JavaScript libraries are restricted. Inline scripts
                      and styles are supported, subject to the preview security policy.
                    </span>
                  </p>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800">
                <p className="font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-2">
                  Supported in the preview
                </p>

                <div className="space-y-1.5 text-emerald-800 dark:text-emerald-300">
                  <p>HTML mode: standard HTML elements, CSS, and inline JavaScript.</p>
                  <p>JSX mode: React components and hooks such as useState, useEffect, useRef, useMemo, and useCallback.</p>
                  <p>Uploaded media URLs and HTTPS images or videos, subject to sandbox restrictions.</p>
                  <p>JavaScript utilities such as Math, Date, JSON, setTimeout, and setInterval.</p>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08]">
                <p className="font-black text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-2">
                  Sandbox restrictions
                </p>

                <div className="space-y-1.5 text-gray-600 dark:text-gray-400">
                  <p>Network requests such as fetch(), XHR, and WebSocket are blocked.</p>
                  <p>Embedded frames, plugins, and form submissions are restricted.</p>
                  <p>External JavaScript libraries and scripts are not allowed in standalone HTML mode.</p>
                  <p>localStorage and sessionStorage are not supported as a reliable persistence mechanism.</p>
                  <p>Tailwind CSS and CSS modules are not configured automatically for JSX mode.</p>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-[#3D7A6E]/10 dark:bg-[#3D7A6E]/20 border border-[#3D7A6E]/20 dark:border-[#3D7A6E]/40">
                <p className="font-black text-[#2F5E55] dark:text-[#4A9384] uppercase tracking-wider mb-2">💡 Quick-start template</p>
                <pre className="text-[#1B3832] dark:text-[#A5C9C1] font-mono text-[10px] leading-relaxed whitespace-pre-wrap bg-[#3D7A6E]/20 dark:bg-[#3D7A6E]/30 p-3 rounded-lg">{`const PocketApp = () => {
                  const [count, setCount] = React.useState(0);
                  return (
                    <div style={{ width: "100%", height: "100%",
                                  display: "flex", alignItems: "center",
                                  justifyContent: "center",
                                  background: "#0f0f0f", color: "#fff" }}>
                      <button
                        onClick={() => setCount(c => c + 1)}
                        style={{ padding: "12px 28px", borderRadius: 8,
                                background: "#3D7A6E", color: "#fff",
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