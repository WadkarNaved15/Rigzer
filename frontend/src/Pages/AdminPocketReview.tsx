// src/Pages/AdminPocketReview.tsx

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  CheckCircle2, XCircle, Clock, RefreshCw, ChevronRight,
  Eye, User, Sparkles, AlertTriangle, Inbox, ZoomIn, Send,
  Terminal, Shield, ShieldAlert, ShieldCheck, ShieldX,
  AlertCircle, Info, Search, Copy, Check, ExternalLink,
  FileCode2, Activity, Ban, Globe, Database, Cpu,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface PocketOwner { _id: string; username: string; email: string; avatar?: string; }
interface Pocket {
  _id: string; owner: PocketOwner; brandName: string; tagline: string;
  sourceCode: string; status: string; updatedAt: string; createdAt: string;
}
type Tab = "preview" | "code" | "security" | "ast";

// ─── Security scanner ────────────────────────────────────────────────────────
interface SecurityFinding {
  severity: "critical" | "high" | "medium" | "low" | "info";
  category: string;
  message: string;
  line?: number;
  snippet?: string;
}

interface SecurityReport {
  score: number; // 0-100, higher = safer
  findings: SecurityFinding[];
  stats: {
    lines: number; chars: number; externalUrls: string[];
    fetchCalls: number; xhrCalls: number; evalUsage: number;
    windowAccess: number; documentAccess: number; storageAccess: number;
    domainRefs: string[];
  };
}

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

function scanCode(code: string): SecurityReport {
  const lines = code.split("\n");
  const findings: SecurityFinding[] = [];

  // Helper: find all occurrences with line number
  const scan = (
    pattern: RegExp,
    severity: SecurityFinding["severity"],
    category: string,
    message: string
  ) => {
    lines.forEach((line, i) => {
      const m = line.match(pattern);
      if (m) findings.push({ severity, category, message, line: i + 1, snippet: line.trim() });
    });
  };

  // ── Network access ───────────────────────────────────────────────────────
  scan(/\bfetch\s*\(/, "critical", "Network", "fetch() call — blocked by CSP connect-src:none in production, but indicates intent to make network requests");
  scan(/new\s+XMLHttpRequest/, "critical", "Network", "XMLHttpRequest — blocked by CSP in production");
  scan(/axios|superagent|got\b|node-fetch/, "high", "Network", "HTTP library import detected");
  scan(/new\s+WebSocket\s*\(/, "high", "Network", "WebSocket connection attempt");
  scan(/navigator\.sendBeacon/, "medium", "Network", "sendBeacon() — may bypass connect-src");
  scan(/new\s+EventSource/, "medium", "Network", "Server-Sent Events connection");

  // ── Eval / code execution ────────────────────────────────────────────────
  scan(/\beval\s*\(/, "critical", "Code Execution", "Direct eval() — arbitrary code execution");
  scan(/new\s+Function\s*\(/, "critical", "Code Execution", "new Function() — arbitrary code execution");
  scan(/setTimeout\s*\(\s*['"`]/, "high", "Code Execution", "setTimeout with string arg — acts like eval");
  scan(/setInterval\s*\(\s*['"`]/, "high", "Code Execution", "setInterval with string arg — acts like eval");
  scan(/\.innerHTML\s*=/, "medium", "XSS", "innerHTML assignment — potential XSS if user-controlled");
  scan(/\.outerHTML\s*=/, "medium", "XSS", "outerHTML assignment — potential XSS");
  scan(/document\.write\s*\(/, "high", "XSS", "document.write() — potential XSS");
  scan(/dangerouslySetInnerHTML/, "medium", "XSS", "dangerouslySetInnerHTML — ensure content is sanitised");

  // ── Parent frame access ──────────────────────────────────────────────────
  scan(/window\.parent/, "critical", "Sandbox Escape", "window.parent access — attempts to reach parent frame");
  scan(/window\.top/, "critical", "Sandbox Escape", "window.top access — attempts to reach top frame");
  scan(/parent\.postMessage|top\.postMessage/, "high", "Sandbox Escape", "postMessage to parent/top frame");
  scan(/window\.opener/, "high", "Sandbox Escape", "window.opener — access to opening window");
  scan(/document\.cookie/, "high", "Data Exfil", "Cookie access — no cookies in sandboxed iframe, but suspicious");
  scan(/localStorage|sessionStorage/, "high", "Data Exfil", "Storage access — blocked by sandbox (no allow-same-origin)");
  scan(/indexedDB/, "medium", "Data Exfil", "IndexedDB access — blocked by sandbox");

  // ── External scripts / iframes ───────────────────────────────────────────
  scan(/createElement\s*\(\s*['"`]script['"`]\s*\)/, "high", "Script Injection", "Dynamic script element creation");
  scan(/createElement\s*\(\s*['"`]iframe['"`]\s*\)/, "medium", "Iframe Injection", "Dynamic iframe creation");
  scan(/import\s*\(/, "medium", "Dynamic Import", "Dynamic import() — may load external code");

  // ── Crypto / mining ──────────────────────────────────────────────────────
  scan(/crypto|miner|mining|coinhive|monero/i, "critical", "Crypto Mining", "Potential cryptocurrency mining code");

  // ── Obfuscation signals ──────────────────────────────────────────────────
  scan(/\\x[0-9a-fA-F]{2}|\\u[0-9a-fA-F]{4}/, "medium", "Obfuscation", "Hex/unicode escapes — possible obfuscation");
  scan(/atob\s*\(|btoa\s*\(/, "medium", "Obfuscation", "Base64 encode/decode — possible payload obfuscation");
  scan(/String\.fromCharCode/, "medium", "Obfuscation", "String.fromCharCode — classic obfuscation technique");

  // ── External URL extraction ───────────────────────────────────────────────
  const urlRegex = /https?:\/\/[^\s'"`,)>]+/g;
  const externalUrls: string[] = [];
  const domainRefs: string[] = [];
  code.match(urlRegex)?.forEach((url) => {
    if (!externalUrls.includes(url)) externalUrls.push(url);
    try {
      const domain = new URL(url).hostname;
      if (!domainRefs.includes(domain)) domainRefs.push(domain);
    } catch {}
  });

  // Flag suspicious domains
  externalUrls.forEach((url) => {
    const lower = url.toLowerCase();
    if (lower.includes("ngrok") || lower.includes("localhost") || /\d+\.\d+\.\d+\.\d+/.test(lower)) {
      findings.push({ severity: "critical", category: "Suspicious URL", message: `Suspicious URL: ${url}` });
    }
  });

  // ── Stats ──────────────────────────────────────────────────────────────
  const countMatches = (pattern: RegExp) => (code.match(new RegExp(pattern.source, "g")) || []).length;
  const stats = {
    lines: lines.length,
    chars: code.length,
    externalUrls,
    domainRefs,
    fetchCalls: countMatches(/\bfetch\s*\(/),
    xhrCalls: countMatches(/new\s+XMLHttpRequest/),
    evalUsage: countMatches(/\beval\s*\(/),
    windowAccess: countMatches(/\bwindow\./),
    documentAccess: countMatches(/\bdocument\./),
    storageAccess: countMatches(/localStorage|sessionStorage/),
  };

  // ── Score ──────────────────────────────────────────────────────────────
  const deductions = findings.reduce((acc, f) => {
    return acc + ({ critical: 30, high: 15, medium: 7, low: 3, info: 0 }[f.severity]);
  }, 0);
  const score = Math.max(0, 100 - deductions);

  findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return { score, findings, stats };
}

// ─── Constants ────────────────────────────────────────────────────────────────
const POCKET_HEIGHT = 480;
const BACKEND_URL   = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

const SEVERITY_COLOR: Record<string, string> = {
  critical: "#ef4444", high: "#f97316", medium: "#eab308",
  low: "#3b82f6", info: "#6b7280",
};
const SEVERITY_BG: Record<string, string> = {
  critical: "rgba(239,68,68,0.08)", high: "rgba(249,115,22,0.08)",
  medium: "rgba(234,179,8,0.08)", low: "rgba(59,130,246,0.08)", info: "rgba(107,114,128,0.08)",
};

// ─── Preview iframe doc ────────────────────────────────────────────────────────
function buildPreviewDoc(jsx: string): string {
  return `<!DOCTYPE html><html lang="en"><head>
  <meta charset="UTF-8"/>
  <meta http-equiv="Content-Security-Policy" content="script-src 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://esm.sh; style-src 'unsafe-inline'; img-src https: data: blob:; default-src 'none';"/>
  <style>*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}html,body{width:100%;height:${POCKET_HEIGHT}px;overflow:hidden;background:#0a0a0a}#root{width:100%;height:${POCKET_HEIGHT}px;overflow:hidden}</style>
</head><body>
  <div id="root"></div>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script type="module">import React from "https://esm.sh/react@18";import ReactDOM from "https://esm.sh/react-dom@18/client";window.React=React;window.ReactDOM=ReactDOM;</script>
  <script>(function poll(){if(!window.React||!window.ReactDOM||!window.Babel)return setTimeout(poll,50);var src=${JSON.stringify(jsx)};try{var compiled=Babel.transform(src,{presets:["react"],plugins:[]}).code;var sloppy=compiled.replace(/^\\s*["']use strict["'];?\\s*/m,"");var wrapped=sloppy+"\\n;if(typeof PocketApp!=='undefined'){window.PocketApp=PocketApp;}";(0,eval)(wrapped);var App=window.PocketApp;if(typeof App!=="function"){document.getElementById("root").innerHTML='<p style="color:#f87171;padding:16px;font-family:monospace;font-size:12px">No PocketApp export found.</p>';}else{window.ReactDOM.createRoot(document.getElementById("root")).render(window.React.createElement(App));}}catch(err){document.getElementById("root").innerHTML='<pre style="color:#f87171;padding:12px;font-size:11px;font-family:monospace;white-space:pre-wrap;overflow:auto">'+err.message.replace(/</g,"&lt;")+"</pre>";}})();</script>
</body></html>`;
}

function relativeTime(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Syntax-highlighted code (no deps) ────────────────────────────────────────
function highlight(code: string, highlights: number[]): string {
  // Very minimal JSX tokeniser for display — not a real parser
  return code
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/(\/\/[^\n]*)(\n|$)/g, '<span style="color:#6a9955">$1</span>$2')
    .replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g, '<span style="color:#ce9178">$1</span>')
    .replace(/\b(import|export|default|const|let|var|function|return|if|else|for|while|class|extends|new|typeof|instanceof|try|catch|throw|async|await|from|of|in)\b/g, '<span style="color:#569cd6">$1</span>')
    .replace(/\b(true|false|null|undefined|this|window|document)\b/g, '<span style="color:#4fc1ff">$1</span>')
    .replace(/\b(\d+\.?\d*)\b/g, '<span style="color:#b5cea8">$1</span>');
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? "#76b900" : score >= 50 ? "#eab308" : score >= 25 ? "#f97316" : "#ef4444";
  const label = score >= 80 ? "SAFE" : score >= 50 ? "REVIEW" : score >= 25 ? "RISKY" : "DANGER";
  const r = 32; const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <svg width={80} height={80} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={40} cy={40} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={6} />
        <circle cx={40} cy={40} r={r} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.6s ease" }} />
      </svg>
      <div style={{ transform: "none", position: "absolute", left: 0, top: 0, width: 80, height: 80,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 18, fontWeight: 900, color, fontFamily: "monospace" }}>{score}</span>
        <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: 2, color, textTransform: "uppercase" }}>{label}</span>
      </div>
    </div>
  );
}

function FindingRow({ f }: { f: SecurityFinding }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", overflow: "hidden" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10,
          padding: "9px 16px", background: "none", border: "none", cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span style={{
          flexShrink: 0, fontSize: 9, fontWeight: 800, letterSpacing: 1.5,
          textTransform: "uppercase", padding: "2px 7px", borderRadius: 4,
          color: SEVERITY_COLOR[f.severity], background: SEVERITY_BG[f.severity],
          minWidth: 58, textAlign: "center",
        }}>{f.severity}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.5)", minWidth: 80, flexShrink: 0 }}>
          {f.category}
        </span>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", flex: 1 }}>{f.message}</span>
        {f.line && (
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: "monospace", flexShrink: 0 }}>
            L{f.line}
          </span>
        )}
        <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 10, flexShrink: 0 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && f.snippet && (
        <div style={{ padding: "0 16px 10px 90px" }}>
          <code style={{
            display: "block", background: "rgba(0,0,0,0.4)", borderRadius: 6,
            padding: "8px 12px", fontSize: 11, fontFamily: "monospace",
            color: SEVERITY_COLOR[f.severity], overflowX: "auto", whiteSpace: "pre",
          }}>
            {f.snippet}
          </code>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, warn }: { icon: React.ReactNode; label: string; value: string | number; warn?: boolean }) {
  return (
    <div style={{
      flex: 1, background: warn && Number(value) > 0 ? SEVERITY_BG.high : "rgba(255,255,255,0.03)",
      border: `1px solid ${warn && Number(value) > 0 ? "rgba(249,115,22,0.2)" : "rgba(255,255,255,0.07)"}`,
      borderRadius: 8, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 4,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: warn && Number(value) > 0 ? "#f97316" : "rgba(255,255,255,0.3)" }}>{icon}</span>
        <span style={{ fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>
          {label}
        </span>
      </div>
      <span style={{
        fontFamily: "monospace", fontSize: 20, fontWeight: 900,
        color: warn && Number(value) > 0 ? "#f97316" : "#fff",
      }}>
        {value}
      </span>
    </div>
  );
}

// ─── Code viewer with security highlights ─────────────────────────────────────
function CodePanel({ code, findings }: { code: string; findings: SecurityFinding[] }) {
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);
  const highlightedLines = new Set(findings.map(f => f.line).filter(Boolean) as number[]);

  const lines = code.split("\n");
  const matchLines = useMemo(() => {
    if (!search.trim()) return new Set<number>();
    const s = search.toLowerCase();
    return new Set(lines.map((l, i) => l.toLowerCase().includes(s) ? i + 1 : null).filter(Boolean) as number[]);
  }, [search, lines]);

  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#070707" }}>
      {/* Toolbar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
        borderBottom: "1px solid rgba(255,255,255,0.06)", background: "#0a0a0a", flexShrink: 0,
      }}>
        <Search size={11} color="rgba(255,255,255,0.25)" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search source…"
          style={{
            flex: 1, background: "none", border: "none", outline: "none",
            color: "#fff", fontSize: 11, fontFamily: "monospace",
          }}
        />
        {search && (
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>
            {matchLines.size} match{matchLines.size !== 1 ? "es" : ""}
          </span>
        )}
        <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.08)" }} />
        {highlightedLines.size > 0 && (
          <span style={{ fontSize: 10, color: "#f97316" }}>
            {highlightedLines.size} flagged line{highlightedLines.size !== 1 ? "s" : ""}
          </span>
        )}
        <button onClick={copy} style={{
          display: "flex", alignItems: "center", gap: 4, background: "none", border: "none",
          cursor: "pointer", color: copied ? "#76b900" : "rgba(255,255,255,0.3)", fontSize: 10,
        }}>
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      {/* Lines */}
      <div style={{ flex: 1, overflow: "auto", fontFamily: "monospace", fontSize: 12, lineHeight: 1.65 }}>
        {lines.map((line, i) => {
          const n = i + 1;
          const isFlag = highlightedLines.has(n);
          const isMatch = matchLines.has(n);
          return (
            <div
              key={n}
              id={`line-${n}`}
              style={{
                display: "flex", minHeight: 21,
                background: isFlag
                  ? "rgba(249,115,22,0.08)"
                  : isMatch ? "rgba(255,255,0,0.05)" : "transparent",
                borderLeft: isFlag
                  ? "2px solid #f97316"
                  : isMatch ? "2px solid #eab308" : "2px solid transparent",
              }}
            >
              <span style={{
                width: 46, flexShrink: 0, textAlign: "right", paddingRight: 14,
                color: isFlag ? "#f97316" : "rgba(255,255,255,0.15)",
                userSelect: "none", fontSize: 10, paddingTop: 1,
              }}>
                {isFlag ? "⚠" : n}
              </span>
              <span
                style={{ color: "#a3e635", whiteSpace: "pre", paddingRight: 24 }}
                dangerouslySetInnerHTML={{ __html: highlight(line || " ", []) }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Security panel ────────────────────────────────────────────────────────────
function SecurityPanel({ report, code }: { report: SecurityReport; code: string }) {
  const { score, findings, stats } = report;
  const scoreColor = score >= 80 ? "#76b900" : score >= 50 ? "#eab308" : score >= 25 ? "#f97316" : "#ef4444";
  const critical = findings.filter(f => f.severity === "critical");
  const high     = findings.filter(f => f.severity === "high");
  const medium   = findings.filter(f => f.severity === "medium");
  const low      = findings.filter(f => f.severity === "low");

  const jumpTo = (line: number) => {
    const el = document.getElementById(`line-${line}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div style={{ height: "100%", overflow: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Score header */}
      <div style={{
        background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 12, padding: 20, display: "flex", alignItems: "center", gap: 20,
      }}>
        {/* Ring */}
        <div style={{ position: "relative", width: 80, height: 80, flexShrink: 0 }}>
          <svg width={80} height={80} style={{ transform: "rotate(-90deg)" }}>
            <circle cx={40} cy={40} r={32} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={6} />
            <circle cx={40} cy={40} r={32} fill="none" stroke={scoreColor} strokeWidth={6}
              strokeDasharray={`${(score / 100) * (2 * Math.PI * 32)} ${2 * Math.PI * 32}`}
              strokeLinecap="round" />
          </svg>
          <div style={{
            position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: scoreColor, fontFamily: "monospace" }}>{score}</span>
            <span style={{ fontSize: 7, fontWeight: 800, letterSpacing: 2, color: scoreColor, textTransform: "uppercase" }}>
              {score >= 80 ? "SAFE" : score >= 50 ? "REVIEW" : score >= 25 ? "RISKY" : "DANGER"}
            </span>
          </div>
        </div>

        {/* Finding counts */}
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 10 }}>Security scan complete</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { label: "Critical", count: critical.length, color: "#ef4444" },
              { label: "High",     count: high.length,     color: "#f97316" },
              { label: "Medium",   count: medium.length,   color: "#eab308" },
              { label: "Low",      count: low.length,      color: "#3b82f6" },
            ].map(({ label, count, color }) => (
              <div key={label} style={{
                padding: "4px 10px", borderRadius: 6,
                background: count > 0 ? `${color}18` : "rgba(255,255,255,0.03)",
                border: `1px solid ${count > 0 ? `${color}40` : "rgba(255,255,255,0.07)"}`,
                fontSize: 11, fontWeight: 700,
                color: count > 0 ? color : "rgba(255,255,255,0.2)",
              }}>
                {count} {label}
              </div>
            ))}
          </div>
        </div>

        {/* Overall verdict */}
        <div style={{
          padding: "12px 16px", borderRadius: 10,
          background: score >= 80 ? "rgba(118,185,0,0.08)" : score >= 50 ? "rgba(234,179,8,0.08)" : "rgba(239,68,68,0.08)",
          border: `1px solid ${scoreColor}30`,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
        }}>
          {score >= 80
            ? <ShieldCheck size={22} color="#76b900" />
            : score >= 50
            ? <Shield size={22} color="#eab308" />
            : <ShieldX size={22} color="#ef4444" />
          }
          <span style={{ fontSize: 10, fontWeight: 800, color: scoreColor, letterSpacing: 1 }}>
            {score >= 80 ? "APPROVE" : score >= 50 ? "CAUTION" : "REJECT"}
          </span>
        </div>
      </div>

      {/* Stats grid */}
      <div>
        <p style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>
          Code statistics
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <StatCard icon={<FileCode2 size={12} />} label="Lines"   value={stats.lines} />
          <StatCard icon={<Cpu size={12} />}       label="Chars"   value={stats.chars.toLocaleString()} />
          <StatCard icon={<Globe size={12} />}     label="Fetches" value={stats.fetchCalls}     warn />
          <StatCard icon={<Activity size={12} />}  label="Evals"   value={stats.evalUsage}      warn />
          <StatCard icon={<Database size={12} />}  label="Storage" value={stats.storageAccess}  warn />
          <StatCard icon={<Ban size={12} />}       label="Parent"  value={(code.match(/window\.parent|window\.top/g) || []).length} warn />
        </div>
      </div>

      {/* External URLs */}
      {stats.externalUrls.length > 0 && (
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 7 }}>
            <Globe size={12} color="rgba(255,255,255,0.4)" />
            <span style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>
              External URLs ({stats.externalUrls.length})
            </span>
          </div>
          <div style={{ padding: "8px 14px", display: "flex", flexDirection: "column", gap: 4 }}>
            {stats.externalUrls.map((url, i) => {
              const isSuspicious = url.includes("ngrok") || url.includes("localhost") || /\d+\.\d+\.\d+\.\d+/.test(url);
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: isSuspicious ? "#ef4444" : "#6b7280",
                    background: isSuspicious ? "rgba(239,68,68,0.1)" : "rgba(107,114,128,0.1)",
                    padding: "1px 5px", borderRadius: 3 }}>
                    {isSuspicious ? "UNSAFE" : "URL"}
                  </span>
                  <code style={{ fontSize: 10, color: isSuspicious ? "#f87171" : "rgba(255,255,255,0.5)", fontFamily: "monospace", wordBreak: "break-all" }}>
                    {url}
                  </code>
                  <a href={url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                    style={{ marginLeft: "auto", color: "rgba(255,255,255,0.2)", flexShrink: 0 }}>
                    <ExternalLink size={10} />
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Findings list */}
      {findings.length > 0 ? (
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: 7 }}>
            <ShieldAlert size={12} color="rgba(255,255,255,0.4)" />
            <span style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>
              Findings ({findings.length})
            </span>
          </div>
          {findings.map((f, i) => <FindingRow key={i} f={f} />)}
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px",
          background: "rgba(118,185,0,0.05)", border: "1px solid rgba(118,185,0,0.15)", borderRadius: 10 }}>
          <ShieldCheck size={18} color="#76b900" />
          <div>
            <p style={{ color: "#76b900", fontWeight: 700, fontSize: 13 }}>No security issues detected</p>
            <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, marginTop: 2 }}>
              Static scan found no patterns of concern. Review the preview and source before approving.
            </p>
          </div>
        </div>
      )}

      <p style={{ fontSize: 10, color: "rgba(255,255,255,0.18)", lineHeight: 1.6, marginTop: 4 }}>
        ⚠ This is a static pattern scan, not a sandbox execution trace. It catches common attack vectors but is not exhaustive.
        Always review the preview and source code before approving. The production iframe enforces CSP connect-src:none and
        sandbox without allow-same-origin, which blocks most network and storage attacks at runtime.
      </p>
    </div>
  );
}

// ─── Queue row ─────────────────────────────────────────────────────────────────
function PocketRow({ pocket, selected, onClick }: { pocket: Pocket; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      width: "100%", background: selected ? "rgba(118,185,0,0.07)" : "transparent",
      borderLeft: selected ? "2px solid #76b900" : "2px solid transparent",
      padding: "13px 16px", display: "flex", alignItems: "center", gap: 10,
      borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", border: "none",
      textAlign: "left",
    }}>
      <img src={pocket.owner.avatar || "/default_avatar.png"} alt={pocket.owner.username}
        style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", flexShrink: 0,
          outline: selected ? "2px solid #76b900" : "none" }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 12, fontFamily: "monospace",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {pocket.brandName}
          </span>
        </div>
        <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10 }}>
          @{pocket.owner.username} · {relativeTime(pocket.updatedAt)}
        </div>
      </div>
      <ChevronRight size={12} color={selected ? "#76b900" : "rgba(255,255,255,0.15)"} />
    </button>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
const AdminPocketReview: React.FC = () => {
  const [pockets, setPockets]         = useState<Pocket[]>([]);
  const [selected, setSelected]       = useState<Pocket | null>(null);
  const [tab, setTab]                 = useState<Tab>("security");
  const [rejectNote, setRejectNote]   = useState("");
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [loading, setLoading]         = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast]             = useState<{ msg: string; ok: boolean } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const secReport = useMemo(() =>
    selected ? scanCode(selected.sourceCode) : null,
    [selected]
  );

  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${BACKEND_URL}/api/pockets/pending`, { credentials: "include" });
      const data = await res.json();
      setPockets(data.pockets ?? []);
      setSelected(prev => prev ? (data.pockets ?? []).find((p: Pocket) => p._id === prev._id) ?? null : null);
    } catch { showToast("Failed to load queue", false); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPending(); }, []);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const handleApprove = async () => {
    if (!selected || actionLoading) return;
    setActionLoading(true);
    try {
      const res  = await fetch(`${BACKEND_URL}/api/pockets/${selected._id}/review`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      showToast(`✓ ${selected.brandName} approved and live`, true);
      setSelected(null); setShowRejectBox(false); fetchPending();
    } catch (err: any) { showToast(err.message ?? "Approval failed", false); }
    finally { setActionLoading(false); }
  };

  const handleReject = async () => {
    if (!selected || actionLoading || !rejectNote.trim()) return;
    setActionLoading(true);
    try {
      const res  = await fetch(`${BACKEND_URL}/api/pockets/${selected._id}/review`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", note: rejectNote.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      showToast(`✗ ${selected.brandName} rejected`, false);
      setSelected(null); setShowRejectBox(false); setRejectNote(""); fetchPending();
    } catch (err: any) { showToast(err.message ?? "Rejection failed", false); }
    finally { setActionLoading(false); }
  };

  const previewSrc = selected
    ? `data:text/html;charset=utf-8,${encodeURIComponent(buildPreviewDoc(selected.sourceCode))}`
    : "";

  const TABS: { id: Tab; icon: React.ReactNode; label: string; badge?: number | string }[] = selected ? [
    { id: "security", icon: <Shield size={12} />, label: "Security",
      badge: secReport ? secReport.findings.filter(f => f.severity === "critical" || f.severity === "high").length : 0 },
    { id: "preview",  icon: <Eye size={12} />,     label: "Preview" },
    { id: "code",     icon: <Terminal size={12} />, label: "Source",
      badge: `${selected.sourceCode.split("\n").length}L` },
  ] : [];

  return (
    <div style={{
      display: "flex", height: "100vh", background: "#0b0b0b",
      fontFamily: "'DM Sans', system-ui, sans-serif", color: "#fff", overflow: "hidden",
    }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 999,
          padding: "10px 18px", borderRadius: 8,
          background: toast.ok ? "rgba(118,185,0,0.15)" : "rgba(239,68,68,0.15)",
          border: `1px solid ${toast.ok ? "#76b900" : "#ef4444"}`,
          color: toast.ok ? "#a3e635" : "#f87171",
          fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 8,
          backdropFilter: "blur(12px)", animation: "fadeIn 0.2s ease",
          boxShadow: `0 8px 32px ${toast.ok ? "rgba(118,185,0,0.15)" : "rgba(239,68,68,0.15)"}`,
        }}>
          {toast.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
          {toast.msg}
        </div>
      )}

      {/* Left panel */}
      <div style={{
        width: 260, flexShrink: 0, borderRight: "1px solid rgba(255,255,255,0.06)",
        display: "flex", flexDirection: "column", background: "#0d0d0d",
      }}>
        <div style={{ padding: "16px 14px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <Sparkles size={13} color="#76b900" />
              <span style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>Pocket Queue</span>
            </div>
            <button onClick={fetchPending} disabled={loading} style={{
              background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.25)",
              padding: 4, borderRadius: 4,
            }}>
              <RefreshCw size={12} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            </button>
          </div>
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 5 }}>
            <Clock size={10} color="rgba(255,255,255,0.25)" />
            <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>
              {pockets.length} pending review
            </span>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 28 }}>
              <div style={{ width: 18, height: 18, borderRadius: "50%",
                border: "2px solid rgba(118,185,0,0.2)", borderTopColor: "#76b900",
                animation: "spin 0.8s linear infinite" }} />
            </div>
          ) : pockets.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
              padding: "40px 20px", gap: 10 }}>
              <Inbox size={24} color="rgba(255,255,255,0.1)" />
              <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, textAlign: "center" }}>
                Queue empty
              </p>
            </div>
          ) : (
            pockets.map(p => (
              <PocketRow key={p._id} pocket={p} selected={selected?._id === p._id}
                onClick={() => { setSelected(p); setTab("security"); setShowRejectBox(false); setRejectNote(""); }} />
            ))
          )}
        </div>
      </div>

      {/* Right panel */}
      {!selected ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "rgba(118,185,0,0.06)",
            border: "1px solid rgba(118,185,0,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ZoomIn size={20} color="rgba(118,185,0,0.4)" />
          </div>
          <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 12 }}>
            Select a pocket to review
          </p>
        </div>
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Header */}
          <div style={{
            padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "#0d0d0d", flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img src={selected.owner.avatar || "/default_avatar.png"} alt={selected.owner.username}
                style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover" }} />
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ fontWeight: 800, fontSize: 14 }}>{selected.brandName}</span>
                  {selected.tagline && (
                    <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>— {selected.tagline}</span>
                  )}
                  {/* Inline score badge */}
                  {secReport && (
                    <span style={{
                      fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 5,
                      color: secReport.score >= 80 ? "#76b900" : secReport.score >= 50 ? "#eab308" : "#ef4444",
                      background: secReport.score >= 80 ? "rgba(118,185,0,0.1)" : secReport.score >= 50 ? "rgba(234,179,8,0.1)" : "rgba(239,68,68,0.1)",
                    }}>
                      {secReport.score}/100
                    </span>
                  )}
                </div>
                <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, marginTop: 1, display: "flex", alignItems: "center", gap: 5 }}>
                  <User size={9} />
                  @{selected.owner.username} · {selected.owner.email} · {relativeTime(selected.updatedAt)}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", background: "rgba(255,255,255,0.04)", borderRadius: 7, padding: 3, gap: 1 }}>
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  padding: "5px 12px", borderRadius: 5, border: "none", cursor: "pointer",
                  fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 5,
                  background: tab === t.id ? "rgba(118,185,0,0.15)" : "transparent",
                  color: tab === t.id ? "#76b900" : "rgba(255,255,255,0.35)",
                  transition: "all 0.12s",
                }}>
                  {t.icon} {t.label}
                  {typeof t.badge === "number" && t.badge > 0 && (
                    <span style={{
                      background: "#ef4444", color: "#fff", borderRadius: 10,
                      fontSize: 9, fontWeight: 900, padding: "0 5px", minWidth: 16, textAlign: "center",
                    }}>{t.badge}</span>
                  )}
                  {typeof t.badge === "string" && (
                    <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 9 }}>{t.badge}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflow: "hidden" }}>
            {tab === "security" && secReport && (
              <SecurityPanel report={secReport} code={selected.sourceCode} />
            )}
            {tab === "preview" && (
              <div style={{ height: "100%", overflow: "auto", background: "#111", padding: 20 }}>
                <p style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", letterSpacing: 1.5,
                  textTransform: "uppercase", marginBottom: 10, fontFamily: "monospace" }}>
                  LIVE PREVIEW — {POCKET_HEIGHT}px canvas · sandbox: allow-scripts only
                </p>
                <div style={{ maxWidth: 720, borderRadius: 12, overflow: "hidden",
                  border: "1px solid rgba(118,185,0,0.15)", height: POCKET_HEIGHT,
                  boxShadow: "0 0 40px rgba(118,185,0,0.04)" }}>
                  <iframe key={selected._id} title="pocket-preview" src={previewSrc}
                    sandbox="allow-scripts allow-popups" referrerPolicy="no-referrer"
                    style={{ width: "100%", height: POCKET_HEIGHT, border: "none", display: "block" }} />
                </div>
                {secReport && secReport.findings.filter(f => f.severity === "critical").length > 0 && (
                  <div style={{ maxWidth: 720, marginTop: 12, padding: "10px 14px", borderRadius: 8,
                    background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                    display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <ShieldAlert size={14} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
                    <p style={{ fontSize: 11, color: "#f87171", lineHeight: 1.5 }}>
                      <strong>Critical issues detected.</strong> The preview runs in an isolated sandbox with
                      CSP connect-src:none — network calls are blocked. However, review the Security tab before approving.
                    </p>
                  </div>
                )}
              </div>
            )}
            {tab === "code" && (
              <CodePanel code={selected.sourceCode} findings={secReport?.findings ?? []} />
            )}
          </div>

          {/* Action bar */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "#0d0d0d", padding: "12px 20px", flexShrink: 0 }}>
            {showRejectBox && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5,
                  color: "#f87171", fontSize: 10, fontWeight: 700 }}>
                  <AlertTriangle size={11} />
                  Rejection reason — sent to creator
                </div>
                <textarea ref={textareaRef} value={rejectNote} onChange={e => setRejectNote(e.target.value)}
                  placeholder="e.g. Contains prohibited network calls, broken layout, obfuscated code..."
                  autoFocus rows={2} style={{
                    width: "100%", background: "rgba(239,68,68,0.05)",
                    border: "1px solid rgba(239,68,68,0.2)", borderRadius: 7,
                    color: "#fff", fontSize: 11, fontFamily: "monospace",
                    padding: "9px 12px", resize: "none", outline: "none", lineHeight: 1.5, boxSizing: "border-box",
                  }} />
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={handleApprove} disabled={actionLoading || showRejectBox} style={{
                display: "flex", alignItems: "center", gap: 6,
                background: actionLoading || showRejectBox ? "rgba(118,185,0,0.06)" : "#76b900",
                color: actionLoading || showRejectBox ? "rgba(118,185,0,0.3)" : "#000",
                border: "none", borderRadius: 7, padding: "9px 18px",
                fontWeight: 800, fontSize: 11, cursor: actionLoading || showRejectBox ? "not-allowed" : "pointer",
              }}>
                <CheckCircle2 size={13} />
                {actionLoading ? "Processing…" : "Approve & Publish"}
              </button>

              {!showRejectBox ? (
                <button onClick={() => { setShowRejectBox(true); setTimeout(() => textareaRef.current?.focus(), 40); }}
                  disabled={actionLoading} style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: "rgba(239,68,68,0.07)", color: "#f87171",
                    border: "1px solid rgba(239,68,68,0.18)", borderRadius: 7, padding: "9px 18px",
                    fontWeight: 800, fontSize: 11, cursor: actionLoading ? "not-allowed" : "pointer",
                  }}>
                  <XCircle size={13} /> Reject
                </button>
              ) : (
                <>
                  <button onClick={handleReject} disabled={actionLoading || !rejectNote.trim()} style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: rejectNote.trim() ? "#ef4444" : "rgba(239,68,68,0.07)",
                    color: rejectNote.trim() ? "#fff" : "rgba(239,68,68,0.25)",
                    border: "none", borderRadius: 7, padding: "9px 18px",
                    fontWeight: 800, fontSize: 11,
                    cursor: rejectNote.trim() && !actionLoading ? "pointer" : "not-allowed",
                  }}>
                    <Send size={12} /> Send Rejection
                  </button>
                  <button onClick={() => { setShowRejectBox(false); setRejectNote(""); }} style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "rgba(255,255,255,0.25)", fontSize: 11, padding: "9px 10px",
                  }}>
                    Cancel
                  </button>
                </>
              )}

              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
                {secReport && secReport.findings.filter(f => f.severity === "critical").length > 0 && (
                  <span style={{ fontSize: 10, color: "#ef4444", display: "flex", alignItems: "center", gap: 4 }}>
                    <AlertCircle size={11} />
                    {secReport.findings.filter(f => f.severity === "critical").length} critical issue{secReport.findings.filter(f => f.severity === "critical").length > 1 ? "s" : ""}
                  </span>
                )}
                <span style={{ color: "rgba(255,255,255,0.15)", fontSize: 10, fontFamily: "monospace" }}>
                  {selected.sourceCode.length.toLocaleString()} / 60,000 ch
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        @keyframes spin   { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateX(-50%) translateY(-4px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 3px; height: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 3px; }
      `}</style>
    </div>
  );
};

export default AdminPocketReview;