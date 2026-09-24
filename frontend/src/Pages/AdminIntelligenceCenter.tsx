/**
 * AdminIntelligenceCenter.tsx
 * Rigzer Admin Intelligence Center
 * Route: /admin/analytics
 *
 * Matches Rigzer glassmorphism design system exactly.
 * Separate deep-dive modules (Creator Analytics, Session Monitoring) are linked but not duplicated.
 */

import {
  useState, useEffect, useCallback, useRef, useMemo,
  createContext, useContext,
} from "react";
import axios from "axios";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { useNavigate } from "react-router-dom";

// ─────────────────────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────────────────────
type RangeKey =
  | "today" | "yesterday" | "7d" | "30d"
  | "thisMonth" | "lastMonth" | "3m" | "6m"
  | "thisYear" | "all" | "custom";

interface DateRange { range: RangeKey; from?: string; to?: string; }

interface OverviewData {
  rangeLabel: string;
  users: {
    total: number; newUsers: number; verified: number; pocketEligible: number;
    dau: number; wau: number; mau: number; followerGrowth: number;
    activeUsers: number; retentionRate: string;
  };
  content: {
    totalPosts: number; createdPosts: number;
    totalViews: number; totalUniqueViews: number;
    totalLikes: number; totalComments: number; totalShares: number;
    engagementRate: number; avgEngagementPerPost: string;
    typeBreakdown: Record<string, { count: number; views: number; likes: number; comments: number; shares: number }>;
  };
  games: {
    total: number; created: number; verified: number; pending: number;
    failed: number; hidden: number; exhausted: number; totalCreditsUsed: number;
  };
  sessions: {
    total: number; completed: number; failed: number;
    uniquePlayers: number; totalCredits: number; totalPlayTime: number;
    avgSessionDuration: number; successRate: number; failureRate: number;
  };
  advertising: {
    impressions: number; clicks: number; ctr: number;
    adModelViews: number; mediaAdCount: number; adModelCount: number;
    topBrands: { _id: string; impressions: number; clicks: number }[];
  };
  health: {
    failureRate: number; crashRate: number; disconnectRate: number;
    abandonRate: number; sessionSuccessRate: number; avgQueueTimeMs: number;
  };
    website: {
    totalSessions: number;
    activeSessions: number;
    avgSessionDuration: number;
    avgActiveTime: number;
    avgPagesPerSession: number;
    avgActionsPerSession: number;
    bounceRate: number;
  };

  devices: {
    desktop: number;
    mobile: number;
    tablet: number;
    unknown: number;
  };

  browsers: {
    browser: string;
    sessions: number;
  }[];

  operatingSystems: {
    os: string;
    sessions: number;
  }[];
}

interface GrowthData {
  userGrowth: {
    date: string;
    users: number;
  }[];

  postGrowth: {
    date: string;

    views: number;
    uniqueViews: number;

    likes: number;
    comments: number;
    shares: number;

    profileViews: number;
    gameLaunches: number;

    creditsConsumed: number;
  }[];

  sessionGrowth: {
    date: string;
    sessions: number;
    activeUsers: number;
  }[];
}

interface UserRow {
  _id: string; username: string; email: string; role: string;
  isVerified: boolean; isPocketEligible: boolean;
  followersCount: number; followingCount: number;
  createdAt: string; updatedAt: string;
  postStats?: { postsCount: number; totalViews: number; totalLikes: number; totalComments: number; gamesCount: number };
}

interface PostRow {
  _id: string; type: string; createdAt: string;
  viewsCount: number; uniqueViewsCount: number; likesCount: number; commentsCount: number; sharesCount: number;
  description: string;
  creator?: { username: string };
  gamePost?: { gameName: string };
  modelPost?: { title: string };
  adModelPost?: { brandName: string };
  mediaAdPost?: { brandName: string };
}

interface CreatorRow {
  _id: string; username: string; avatar: string; email: string;
  followersCount: number; isVerified: boolean;
  totalViews: number; totalLikes: number; postsCount: number; totalShares: number; commentsCount: number;
  gamesCount: number; totalSessions: number; totalPlayTime: number;
  createdAt: string;
}

interface GameRow {
  _id: string;

  gamePost?: {
    gameName: string;
    verification?: {
      status: string;
    };

    visibility?: string;

    creditBudget?: {
      status: string;
    };

    snapshot?: {
      status: string;
      sourceRegion?: string | null;
      sourceSnapshotId?: string | null;

      regions?: {
        region: string;
        snapshotId?: string | null;
        status: string;
        error?: string | null;
        createdAt?: string | null;
        completedAt?: string | null;
      }[];
    };
  };

  creator?: {
    username: string;
  };

  viewsCount: number;
  likesCount: number;

  sessionStats?: {
    totalSessions: number;
    uniquePlayers: number;
    totalPlayTime: number;
    totalCredits: number;
    failureRate: number;
    crashRate: number;
  };

  createdAt: string;
}

interface ModelRow {
  _id: string;
  modelPost?: { title: string; price: number; assets: number };
  creator?: { username: string };
  viewsCount: number; uniqueViewsCount: number; likesCount: number; commentsCount: number; sharesCount: number;
  createdAt: string;
}

interface AdBrandRow {
  _id: string; impressions: number; clicks: number;
  views?: number; uniqueViews?: number; likes?: number; count: number;
  ctr?: number;
}

interface Alert {
  type: string; severity: "critical" | "warning" | "info";
  title: string; body: string;
  items?: { _id?: string; gamePost?: { gameName: string }; gameName?: string; failureRate?: number }[];
}

interface PaginatedResponse<T> { rows: T[]; total: number; page: number; pageSize: number; totalPages: number; }

// ─────────────────────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────────────────────
const BASE_URL = `${import.meta.env.VITE_BACKEND_URL}/api/admin/intelligence`;

const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: "today",      label: "Today"         },
  { value: "yesterday",  label: "Yesterday"     },
  { value: "7d",         label: "Last 7 Days"   },
  { value: "30d",        label: "Last 30 Days"  },
  { value: "thisMonth",  label: "This Month"    },
  { value: "lastMonth",  label: "Last Month"    },
  { value: "3m",         label: "Last 3 Months" },
  { value: "6m",         label: "Last 6 Months" },
  { value: "thisYear",   label: "This Year"     },
  { value: "all",        label: "All Time"      },
  { value: "custom",     label: "Custom…"       },
];

const POST_TYPE_LABELS: Record<string, string> = {
  normal_post:    "Normal Post",
  game_post:      "Game",
  model_post:     "3D Model",
  devlog_post:    "Devlog",
  canvas_article: "Canvas Article",
  ad_model_post:  "3D Ad",
  media_ad_post:  "Media Ad",
};

const POST_TYPE_COLORS: Record<string, string> = {
  normal_post:    "#3D7A6E",
  game_post:      "#5bbfaa",
  model_post:     "#4a9dcc",
  devlog_post:    "#c9a84c",
  canvas_article: "#8b5cf6",
  ad_model_post:  "#f4a261",
  media_ad_post:  "#ef4444",
};

const NAV_SECTIONS = [
  { id: "overview",   label: "Executive Overview",  icon: "⬡" },
  { id: "growth",     label: "Growth Analytics",    icon: "◈" },
  { id: "users",      label: "Users",               icon: "⊙" },
  { id: "posts",      label: "Posts",               icon: "⊟" },
  { id: "creators",   label: "Creators",            icon: "✦" },
  { id: "games",      label: "Game Intelligence",   icon: "▣" },
  { id: "models",     label: "Model Marketplace",   icon: "⬡" },
  { id: "ads",        label: "Advertising",         icon: "◎" },
  { id: "discovery",  label: "Discovery",           icon: "◉" },
  { id: "alerts",     label: "Alerts",              icon: "⚠" },
] as const;
type NavId = typeof NAV_SECTIONS[number]["id"];

// ─────────────────────────────────────────────────────────────
//  DATE RANGE CONTEXT
// ─────────────────────────────────────────────────────────────
const DRCtx = createContext<{ dr: DateRange; setDr: (d: DateRange) => void }>({
  dr: { range: "30d" }, setDr: () => {},
});
const useDR = () => useContext(DRCtx);

function drToParams(dr: DateRange): Record<string, string | undefined> {
  if (dr.range === "custom") return { from: dr.from, to: dr.to };
  return { range: dr.range };
}

// ─────────────────────────────────────────────────────────────
//  API
// ─────────────────────────────────────────────────────────────
const api = axios.create({ baseURL: BASE_URL, withCredentials: true });

async function apiFetch<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const res = await api.get<{ success: boolean; data: T }>(path, { params });
  return res.data.data;
}

// ─────────────────────────────────────────────────────────────
//  FORMATTERS
// ─────────────────────────────────────────────────────────────
const fmtNum = (n: number | null | undefined): string => {
  if (n == null || isNaN(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
};
const fmtDuration = (ms: number | null | undefined): string => {
  if (!ms) return "—";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${Math.floor(ms / 1000)}s`;
};
const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
};
const fmtPct = (n: number) => `${Number(n).toFixed(1)}%`;

// ─────────────────────────────────────────────────────────────
//  DESIGN ATOMS
// ─────────────────────────────────────────────────────────────
function GlassCard({ children, className = "", onClick, accent = false }: {
  children: React.ReactNode; className?: string; onClick?: () => void; accent?: boolean;
}) {
  return (
    <div onClick={onClick} className={[
      "rounded-2xl border backdrop-blur-md",
      accent ? "bg-teal-900/20 border-teal-600/30" : "bg-white/[0.04] border-white/[0.08]",
      onClick ? "cursor-pointer hover:border-teal-600/40 transition-all duration-200" : "",
      className,
    ].join(" ")}>{children}</div>
  );
}

function KpiCard({ label, value, sub, accent = "default", icon, delta }: {
  label: string; value: string; sub?: string;
  accent?: "default" | "teal" | "green" | "red" | "amber" | "blue" | "purple";
  icon?: string; delta?: number;
}) {
  const accentMap: Record<string, string> = {
    default: "text-white/90", teal: "text-teal-400", green: "text-green-400",
    red: "text-red-400", amber: "text-amber-400", blue: "text-blue-400",
    purple: "text-purple-400",
  };
  return (
    <GlassCard className="p-4 flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/35">{label}</span>
        {icon && <span className="text-white/20 text-sm">{icon}</span>}
      </div>
      <span className={`text-[22px] font-bold leading-none tabular-nums ${accentMap[accent]}`}>{value}</span>
      <div className="flex items-center gap-2">
        {sub && <span className="text-[11px] text-white/25">{sub}</span>}
        {delta !== undefined && (
          <span className={`text-[10px] font-bold ${delta >= 0 ? "text-green-400" : "text-red-400"}`}>
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}%
          </span>
        )}
      </div>
    </GlassCard>
  );
}

function SectionHeader({ title, sub, actions }: {
  title: string; sub?: string; actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-0.5 h-5 rounded-sm bg-teal-600" />
          <h2 className="text-base font-bold text-white/90 m-0">{title}</h2>
        </div>
        {sub && <p className="text-[12px] text-white/35 pl-3 m-0">{sub}</p>}
      </div>
      {actions && <div className="flex gap-2 items-center">{actions}</div>}
    </div>
  );
}

function SubSection({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mb-2.5 mt-5">
      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/25">{label}</span>
      <div className="flex-1 h-px bg-white/[0.06]" />
    </div>
  );
}

function Btn({ children, onClick, variant = "ghost", disabled, size = "sm", loading }: {
  children: React.ReactNode; onClick?: () => void;
  variant?: "ghost" | "teal" | "danger"; disabled?: boolean; size?: "sm" | "md"; loading?: boolean;
}) {
  const variants: Record<string, string> = {
    ghost:  "bg-white/5 border border-white/[0.08] text-white/50 hover:text-white/80 hover:border-white/15",
    teal:   "bg-teal-700/40 border border-teal-600/40 text-teal-300 hover:bg-teal-700/60",
    danger: "bg-red-900/30 border border-red-600/30 text-red-400 hover:bg-red-900/50",
  };
  const sizes: Record<string, string> = { sm: "px-3 py-1.5 text-[11px]", md: "px-4 py-2 text-[12px]" };
  return (
    <button onClick={onClick} disabled={disabled || loading}
      className={`inline-flex items-center gap-1.5 rounded-xl font-semibold transition-all duration-150 ${variants[variant]} ${sizes[size]} ${(disabled || loading) ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}>
      {loading ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> : children}
    </button>
  );
}

function SelectFilter({ value, onChange, options }: {
  value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select value={value} onChange={onChange}
      className="bg-[#161616] border border-white/[0.08] rounded-xl px-2.5 py-1.5 text-[11px] text-white/70 outline-none focus:border-teal-600/50 transition-colors">
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function SearchInput({ value, onChange, placeholder }: {
  value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; placeholder: string;
}) {
  return (
    <input value={value} onChange={onChange} placeholder={placeholder}
      className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-[13px] text-white/90 placeholder-white/25 outline-none focus:border-teal-600/50 transition-colors w-full" />
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-6 h-6 border-2 border-teal-600/30 border-t-teal-600 rounded-full animate-spin" />
    </div>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-900/20 border border-red-600/20 text-red-400 text-[12px] mb-4">
      <span>⚠ {message}</span>
      {onRetry && <Btn onClick={onRetry} variant="danger" size="sm">Retry</Btn>}
    </div>
  );
}

function SkeletonRow({ cols = 6 }: { cols?: number }) {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="border-b border-white/[0.04]">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-3.5 py-2.5">
              <div className="h-3 rounded bg-white/[0.06] animate-pulse" style={{ width: `${40 + (j * 9) % 55}%` }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function RigzerTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ color: string; name: string; value: number | string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1a1a] border border-white/10 rounded-xl px-3 py-2.5 shadow-2xl">
      {label && <div className="text-[10px] text-white/35 mb-1.5 font-semibold uppercase tracking-wide">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-[12px]">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-white/50">{p.name}:</span>
          <span className="text-white/90 font-semibold tabular-nums">{typeof p.value === "number" ? fmtNum(p.value) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  return (
    <div className="flex gap-1.5">
      <Btn disabled={page <= 1} onClick={() => onPage(1)}>«</Btn>
      <Btn disabled={page <= 1} onClick={() => onPage(page - 1)}>‹</Btn>
      <span className="px-2.5 py-1 text-[11px] text-white/50 font-mono">{page}</span>
      <Btn disabled={page >= totalPages} onClick={() => onPage(page + 1)}>›</Btn>
      <Btn disabled={page >= totalPages} onClick={() => onPage(totalPages)}>»</Btn>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  GLOBAL DATE RANGE PICKER
// ─────────────────────────────────────────────────────────────
function DateRangePicker() {
  const { dr, setDr } = useDR();
  const [showCustom, setShowCustom] = useState(false);
  const [from, setFrom] = useState(dr.from ?? "");
  const [to, setTo] = useState(dr.to ?? "");

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value as RangeKey;
    if (v === "custom") { setShowCustom(true); return; }
    setShowCustom(false);
    setDr({ range: v });
  };

  const applyCustom = () => {
    if (!from && !to) return;
    setDr({ range: "custom", from, to });
    setShowCustom(false);
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-1.5">
        <span className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Range</span>
        <select value={dr.range} onChange={handleChange}
          className="bg-transparent text-[11px] text-teal-400 font-semibold outline-none cursor-pointer">
          {RANGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      {showCustom && (
        <div className="flex items-center gap-1.5 bg-white/[0.04] border border-teal-600/30 rounded-xl px-3 py-1.5">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="bg-transparent text-[11px] text-white/70 outline-none" />
          <span className="text-white/25 text-[10px]">→</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="bg-transparent text-[11px] text-white/70 outline-none" />
          <Btn onClick={applyCustom} variant="teal" size="sm">Apply</Btn>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  CSV EXPORT
// ─────────────────────────────────────────────────────────────
function exportCSV(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const escape = (v: string | number | null | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.join(","), ...rows.map(r => r.map(escape).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: filename });
  a.click(); URL.revokeObjectURL(a.href);
}

// ─────────────────────────────────────────────────────────────
//  usePoller
// ─────────────────────────────────────────────────────────────
function usePoller<T>(fetcher: () => Promise<T>, intervalMs: number, deps: React.DependencyList = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetcher();
      setData(r); setError(null);
    } catch (e) {
      setError(axios.isAxiosError(e) ? (e.response?.data?.message ?? e.message) : (e instanceof Error ? e.message : "Error"));
    } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    setLoading(true); load();
    if (intervalMs > 0) { const id = setInterval(load, intervalMs); return () => clearInterval(id); }
  }, [load, intervalMs]);

  return { data, loading, error, refresh: load };
}

// ─────────────────────────────────────────────────────────────
//  EXECUTIVE OVERVIEW
// ─────────────────────────────────────────────────────────────
function ExecutiveOverview() {
  const { dr } = useDR();
  const params = drToParams(dr);
  const { data, loading, error, refresh } = usePoller<OverviewData>(
    () => apiFetch("/overview", params), 15_000, [JSON.stringify(params)]
  );

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBanner message={error} onRetry={refresh} />;
  if (!data) return null;

const {
  users: u,
  content: c,
  games: g,
  sessions: s,
  advertising: a,
  health: h,

  website: w,
  devices,
  browsers,
  operatingSystems,
} = data;

  const typePieData = Object.entries(c.typeBreakdown ?? {})
    .map(([key, val]) => ({ name: POST_TYPE_LABELS[key] ?? key, value: val.count, color: POST_TYPE_COLORS[key] ?? "#3D7A6E" }))
    .filter(d => d.value > 0);

  return (
    <div>
      <SectionHeader
        title="Executive Overview"
        sub={data.rangeLabel}
        actions={<Btn onClick={refresh} variant="teal" size="sm">↻ Refresh</Btn>}
      />

      {/* User KPIs */}
      <SubSection label="Users" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
        <KpiCard label="Total Users"      value={fmtNum(u.total)}          accent="teal"    icon="⊙" />
        <KpiCard label="New Users"        value={fmtNum(u.newUsers)}        accent="green"   icon="✦" />
        <KpiCard label="Verified"         value={fmtNum(u.verified)}        accent="teal"    icon="◎" />
        <KpiCard label="Pocket Eligible"  value={fmtNum(u.pocketEligible)}  accent="default" icon="◈" />
        <KpiCard label="DAU"              value={fmtNum(u.dau)}             accent="blue"    icon="◉" />
        <KpiCard label="WAU"              value={fmtNum(u.wau)}             accent="blue"    icon="◉" />
        <KpiCard label="MAU"              value={fmtNum(u.mau)}             accent="blue"    icon="◉" />
        <KpiCard label="Retention Rate"   value={`${u.retentionRate}%`}     accent={parseFloat(u.retentionRate) > 30 ? "green" : "amber"} icon="⬡" />
        <KpiCard label="Follower Growth"  value={fmtNum(u.followerGrowth)}  accent="default" icon="▲" />
      </div>

      {/* Content KPIs */}
      <SubSection label="Content" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
        <KpiCard label="Total Posts"       value={fmtNum(c.totalPosts)}          accent="teal"    icon="⊟" />
        <KpiCard label="Posts Created"     value={fmtNum(c.createdPosts)}         accent="green"   icon="✦" />
        <KpiCard label="Total Views"       value={fmtNum(c.totalViews)}           accent="teal"    icon="◎" />
        <KpiCard label="Unique Views"      value={fmtNum(c.totalUniqueViews)}     accent="default" icon="◎" />
        <KpiCard label="Total Likes"       value={fmtNum(c.totalLikes)}           accent="default" icon="♥" />
        <KpiCard label="Total Comments"    value={fmtNum(c.totalComments)}        accent="default" icon="◈" />
        <KpiCard label="Total Shares"      value={fmtNum(c.totalShares)}          accent="default" icon="↗" />
        <KpiCard label="Engagement Rate"   value={fmtPct(c.engagementRate)}       accent={c.engagementRate > 3 ? "green" : "amber"} icon="◉" />
        <KpiCard label="Avg Eng/Post"      value={String(c.avgEngagementPerPost)} accent="default" icon="▣" />
      </div>

      {/* Content Type Breakdown */}
      {typePieData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <GlassCard className="p-4">
            <div className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-3">Content Type Distribution</div>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={typePieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="value">
                  {typePieData.map((entry, i) => <Cell key={i} fill={entry.color} opacity={0.9} />)}
                </Pie>
                <Tooltip content={<RigzerTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "10px", color: "rgba(255,255,255,0.4)" }} />
              </PieChart>
            </ResponsiveContainer>
          </GlassCard>
          <GlassCard className="p-4">
            <div className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-3">Content by Type</div>
            <div className="flex flex-col gap-2">
              {Object.entries(c.typeBreakdown ?? {}).map(([key, val]) => {
                const total = Object.values(c.typeBreakdown ?? {}).reduce((s, v) => s + v.count, 0);
                const pct = total > 0 ? ((val.count / total) * 100) : 0;
                return (
                  <div key={key} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: POST_TYPE_COLORS[key] }} />
                    <span className="text-[11px] text-white/50 w-28 shrink-0">{POST_TYPE_LABELS[key] ?? key}</span>
                    <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: POST_TYPE_COLORS[key] }} />
                    </div>
                    <span className="text-[10px] text-white/40 font-mono w-10 text-right">{fmtNum(val.count)}</span>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        </div>
      )}

      <SubSection label="Website Analytics" />

<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
  <KpiCard
    label="Website Sessions"
    value={fmtNum(w.totalSessions)}
    accent="teal"
    icon="🌐"
  />

  <KpiCard
    label="Active Sessions"
    value={fmtNum(w.activeSessions)}
    accent="green"
    icon="⚡"
  />

  <KpiCard
    label="Avg Session"
    value={fmtDuration(w.avgSessionDuration)}
    accent="blue"
    icon="⏱"
  />

  <KpiCard
    label="Avg Active Time"
    value={fmtDuration(w.avgActiveTime)}
    accent="teal"
    icon="👁"
  />

  <KpiCard
    label="Bounce Rate"
    value={`${w.bounceRate}%`}
    accent={
      w.bounceRate > 60
        ? "red"
        : w.bounceRate > 30
        ? "amber"
        : "green"
    }
    icon="↩"
  />

  <KpiCard
    label="Pages / Session"
    value={String(w.avgPagesPerSession)}
    accent="default"
    icon="📄"
  />

  <KpiCard
    label="Actions / Session"
    value={String(w.avgActionsPerSession)}
    accent="default"
    icon="🎯"
  />
</div>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <GlassCard className="p-4">
  <div className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-4">
    Device Distribution
  </div>

  <ResponsiveContainer width="100%" height={220}>
    <PieChart>
      <Pie
        data={[
          {
            name: "Desktop",
            value: devices.desktop,
          },
          {
            name: "Mobile",
            value: devices.mobile,
          },
          {
            name: "Tablet",
            value: devices.tablet,
          },
          {
            name: "Unknown",
            value: devices.unknown,
          },
        ]}
        dataKey="value"
      >
        <Cell fill="#3D7A6E" />
        <Cell fill="#5bbfaa" />
        <Cell fill="#4a9dcc" />
        <Cell fill="#6b7280" />
      </Pie>

      <Tooltip />
      <Legend />
    </PieChart>
  </ResponsiveContainer>
</GlassCard>
          <GlassCard className="p-4">
  <div className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-4">
    Browser Usage
  </div>

  <ResponsiveContainer width="100%" height={220}>
    <BarChart data={browsers}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="browser" />
      <YAxis />
      <Tooltip />
      <Bar
        dataKey="sessions"
        fill="#3D7A6E"
      />
    </BarChart>
  </ResponsiveContainer>
</GlassCard>

          <GlassCard className="p-4">
  <div className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-4">
    Operating Systems
  </div>

  <ResponsiveContainer width="100%" height={220}>
    <BarChart data={operatingSystems}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="os" />
      <YAxis />
      <Tooltip />
      <Bar
        dataKey="sessions"
        fill="#4a9dcc"
      />
    </BarChart>
  </ResponsiveContainer>
</GlassCard>
        </div>

      {/* Games */}
      <SubSection label="Games" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
        <KpiCard label="Games Published"   value={fmtNum(g.total)}         accent="teal"    icon="▣" />
        <KpiCard label="Verified"          value={fmtNum(g.verified)}       accent="green"   icon="◎" />
        <KpiCard label="Pending"           value={fmtNum(g.pending)}        accent="amber"   icon="◷" />
        <KpiCard label="Failed"            value={fmtNum(g.failed)}         accent="red"     icon="✕" />
        <KpiCard label="Hidden"            value={fmtNum(g.hidden)}         accent="default" icon="⊟" />
        <KpiCard label="Credit Exhausted"  value={fmtNum(g.exhausted)}      accent="amber"   icon="◈" />
        <KpiCard label="Credits Used"      value={fmtNum(g.totalCreditsUsed)} accent="teal"  icon="◈" />
      </div>

      {/* Sessions */}
      <SubSection label="Gaming Sessions" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
        <KpiCard label="Total Sessions"    value={fmtNum(s.total)}           accent="teal"    icon="▣" />
        <KpiCard label="Completed"         value={fmtNum(s.completed)}        accent="green"   icon="◎" />
        <KpiCard label="Failed"            value={fmtNum(s.failed)}           accent="red"     icon="✕" />
        <KpiCard label="Unique Players"    value={fmtNum(s.uniquePlayers)}    accent="blue"    icon="⊙" />
        <KpiCard label="Total Credits"     value={fmtNum(s.totalCredits)}     accent="amber"   icon="◈" />
        <KpiCard label="Total Play Time"   value={fmtDuration(s.totalPlayTime)} accent="teal" icon="◷" />
        <KpiCard label="Avg Session"       value={fmtDuration(s.avgSessionDuration)} accent="default" icon="◷" />
        <KpiCard label="Success Rate"      value={fmtPct(s.successRate)}      accent={s.successRate > 90 ? "green" : "amber"} icon="◉" />
        <KpiCard label="Failure Rate"      value={fmtPct(s.failureRate)}      accent={s.failureRate > 5 ? "red" : "green"} icon="⚠" />
      </div>

      {/* Advertising */}
      <SubSection label="Advertising" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
        <KpiCard label="Media Ad Impressions" value={fmtNum(a.impressions)}   accent="teal"    icon="◎" />
        <KpiCard label="Media Ad Clicks"      value={fmtNum(a.clicks)}        accent="green"   icon="◉" />
        <KpiCard label="CTR"                  value={fmtPct(a.ctr)}           accent={a.ctr > 2 ? "green" : "amber"} icon="▲" />
        <KpiCard label="Ad Model Views"       value={fmtNum(a.adModelViews)}  accent="blue"    icon="◈" />
        <KpiCard label="Media Ads"            value={fmtNum(a.mediaAdCount)}  accent="default" icon="⊟" />
      </div>

      {/* Platform Health */}
      <SubSection label="Platform Health" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
        <KpiCard label="Failure Rate"        value={fmtPct(h.failureRate)}         accent={h.failureRate > 5 ? "red" : "green"}   icon="⚠" />
        <KpiCard label="Crash Rate"          value={fmtPct(h.crashRate)}           accent={h.crashRate > 3 ? "red" : "green"}     icon="✕" />
        <KpiCard label="Disconnect Rate"     value={fmtPct(h.disconnectRate)}      accent={h.disconnectRate > 5 ? "amber" : "green"} icon="◎" />
        <KpiCard label="Abandon Rate"        value={fmtPct(h.abandonRate)}         accent={h.abandonRate > 10 ? "amber" : "green"} icon="⊟" />
        <KpiCard label="Session Success"     value={fmtPct(h.sessionSuccessRate)}  accent={h.sessionSuccessRate > 90 ? "green" : "amber"} icon="◉" />
        <KpiCard label="Avg Queue Time"      value={fmtDuration(h.avgQueueTimeMs)} accent="default" icon="≡" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  GROWTH ANALYTICS
// ─────────────────────────────────────────────────────────────
function GrowthAnalytics() {
  const { dr } = useDR();
  const params = drToParams(dr);
  const { data, loading, error, refresh } = usePoller<GrowthData>(
    () => apiFetch("/growth", params), 60_000, [JSON.stringify(params)]
  );

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBanner message={error} onRetry={refresh} />;
  if (!data) return null;

  const chartProps = {
    cartesian: <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />,
    xAxis: <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />,
    yAxis: <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} width={50} tickFormatter={fmtNum} />,
    tooltip: <Tooltip content={<RigzerTooltip />} />,
  };

  return (
    <div>
      <SectionHeader title="Growth Analytics" sub="Platform-wide growth trends"
        actions={<Btn onClick={refresh} variant="teal" size="sm">↻</Btn>} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* User Growth */}
        <GlassCard className="p-4">
          <div className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-4">User Growth</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data.userGrowth}>
              <defs>
                <linearGradient id="ugGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3D7A6E" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3D7A6E" stopOpacity={0} />
                </linearGradient>
              </defs>
              {chartProps.cartesian}{chartProps.xAxis}{chartProps.yAxis}{chartProps.tooltip}
              <Area type="monotone" dataKey="users" name="New Users" stroke="#3D7A6E" strokeWidth={2} fill="url(#ugGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </GlassCard>

        {/* Content Growth */}
     <GlassCard className="p-4">
  <div className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-4">
    Content Growth
  </div>

  <ResponsiveContainer width="100%" height={200}>
    <AreaChart data={data.postGrowth.map(item => ({
    ...item,
    engagement:
      item.likes +
      item.comments +
      item.shares,
  }))}>
      {chartProps.cartesian}
      {chartProps.xAxis}
      {chartProps.yAxis}
      {chartProps.tooltip}

      <Area
    type="monotone"
    dataKey="engagement"
    name="Engagement"
    stroke="#5bbfaa"
    strokeWidth={2}
    fillOpacity={0.2}
  />
    </AreaChart>
  </ResponsiveContainer>
</GlassCard>
        {/* Views Growth */}
        <GlassCard className="p-4">
          <div className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-4">Views Growth</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data.postGrowth}>
              <defs>
                <linearGradient id="vgGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4a9dcc" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#4a9dcc" stopOpacity={0} />
                </linearGradient>
              </defs>
              {chartProps.cartesian}{chartProps.xAxis}{chartProps.yAxis}{chartProps.tooltip}
              <Area type="monotone" dataKey="views" name="Views" stroke="#4a9dcc" strokeWidth={2} fill="url(#vgGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </GlassCard>

        {/* Engagement Growth */}
        <GlassCard className="p-4">
          <div className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-4">Engagement Growth</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data.postGrowth}>
              {chartProps.cartesian}{chartProps.xAxis}{chartProps.yAxis}{chartProps.tooltip}
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "10px", color: "rgba(255,255,255,0.4)" }} />
              <Line
  type="monotone"
  dataKey="likes"
  name="Likes"
  stroke="#c9a84c"
  strokeWidth={2}
  dot={false}
/>

<Line
  type="monotone"
  dataKey="comments"
  name="Comments"
  stroke="#8b5cf6"
  strokeWidth={2}
  dot={false}
/>

<Line
  type="monotone"
  dataKey="shares"
  name="Shares"
  stroke="#3D7A6E"
  strokeWidth={2}
  dot={false}
/>
            </LineChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard className="p-4">
  <div className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-4">
    Profile Views
  </div>

  <ResponsiveContainer width="100%" height={200}>
    <LineChart data={data.postGrowth}>
      {chartProps.cartesian}
      {chartProps.xAxis}
      {chartProps.yAxis}
      {chartProps.tooltip}

      <Line
        type="monotone"
        dataKey="profileViews"
        name="Profile Views"
        stroke="#4a9dcc"
        strokeWidth={2}
        dot={false}
      />
    </LineChart>
  </ResponsiveContainer>
</GlassCard>

        {/* Session Growth */}
        <GlassCard className="p-4">
          <div className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-4">Game Session Growth</div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data.sessionGrowth}>
  {chartProps.cartesian}
  {chartProps.xAxis}
  {chartProps.yAxis}
  {chartProps.tooltip}

  <Line
    type="monotone"
    dataKey="sessions"
    name="Sessions"
    stroke="#3D7A6E"
    strokeWidth={2}
    dot={false}
  />
</LineChart>
          </ResponsiveContainer>
        </GlassCard>

        {/* Credit Usage Growth */}
        <GlassCard className="p-4">
  <div className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-4">
    Credit Consumption Growth
  </div>

  <ResponsiveContainer width="100%" height={200}>
    <LineChart data={data.postGrowth}>
      {chartProps.cartesian}
      {chartProps.xAxis}
      {chartProps.yAxis}
      {chartProps.tooltip}

      <Line
        type="monotone"
        dataKey="creditsConsumed"
        name="Credits Consumed"
        stroke="#c9a84c"
        strokeWidth={2}
        dot={false}
      />
    </LineChart>
  </ResponsiveContainer>
</GlassCard>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  USERS TABLE
// ─────────────────────────────────────────────────────────────
function UsersTable() {
  const { dr } = useDR();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(""); const [qs, setQs] = useState("");
  const [role, setRole] = useState("all");
  const [verified, setVerified] = useState("all");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { setQs(search); setPage(1); }, 400);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [search]);

  const params = { ...drToParams(dr), page, pageSize: 20, search: qs || undefined, role: role !== "all" ? role : undefined, verified: verified !== "all" ? verified : undefined };
  const { data, loading, error, refresh } = usePoller<PaginatedResponse<UserRow>>(
    () => apiFetch("/users", params), 0, [JSON.stringify(params)]
  );

  const doExport = () => {
    if (!data) return;
    exportCSV("rigzer_users.csv",
      ["ID","Username","Email","Role","Verified","Pocket Eligible","Followers","Following","Posts","Views","Joined"],
      data.rows.map(r => [
        r._id,
        r.username,
        r.email,
        r.role,
        r.isVerified       ? "Yes" : "No",   // ← was r.isVerified (boolean)
        r.isPocketEligible ? "Yes" : "No",   // ← was r.isPocketEligible (boolean)
        r.followersCount,
        r.followingCount,
        r.postStats?.postsCount ?? 0,
        r.postStats?.totalViews ?? 0,
        fmtDate(r.createdAt),
        ])
    );
  };

  return (
    <div>
      <SectionHeader title="User Analytics" sub={data ? `${fmtNum(data.total)} users` : ""}
        actions={<div className="flex gap-2"><Btn onClick={refresh} variant="ghost">↻</Btn><Btn onClick={doExport} variant="teal" disabled={!data}>↓ CSV</Btn></div>} />
      {error && <ErrorBanner message={error} onRetry={refresh} />}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex-1 min-w-[200px]"><SearchInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Search username or email…" /></div>
        <SelectFilter value={role} onChange={e => { setRole(e.target.value); setPage(1); }}
          options={[{ value: "all", label: "All Roles" }, { value: "user", label: "User" }, { value: "admin", label: "Admin" }]} />
        <SelectFilter value={verified} onChange={e => { setVerified(e.target.value); setPage(1); }}
          options={[{ value: "all", label: "All" }, { value: "true", label: "Verified" }, { value: "false", label: "Unverified" }]} />
      </div>
      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/[0.07]">
                {["Username","Email","Role","Verified","Pocket","Followers","Posts","Views","Likes","Joined"].map(h => (
                  <th key={h} className="px-3.5 py-2.5 text-left text-[10px] text-white/25 font-bold uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? <SkeletonRow cols={10} /> : data?.rows.map((row, i) => (
                <tr key={row._id} className={`border-b border-white/[0.04] hover:bg-teal-900/5 transition-colors ${i % 2 ? "bg-white/[0.01]" : ""}`}>
                  <td className="px-3.5 py-2.5 font-semibold text-teal-400">{row.username}</td>
                  <td className="px-3.5 py-2.5 text-white/40 text-[10px] font-mono">{row.email}</td>
                  <td className="px-3.5 py-2.5">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${row.role === "admin" ? "bg-purple-900/30 text-purple-400 border-purple-600/30" : "bg-white/5 text-white/40 border-white/10"}`}>{row.role}</span>
                  </td>
                  <td className="px-3.5 py-2.5 text-[11px]">{row.isVerified ? <span className="text-green-400">✓</span> : <span className="text-white/20">—</span>}</td>
                  <td className="px-3.5 py-2.5 text-[11px]">{row.isPocketEligible ? <span className="text-teal-400">✓</span> : <span className="text-white/20">—</span>}</td>
                  <td className="px-3.5 py-2.5 text-white/60 font-mono">{fmtNum(row.followersCount)}</td>
                  <td className="px-3.5 py-2.5 text-white/50 font-mono">{fmtNum(row.postStats?.postsCount)}</td>
                  <td className="px-3.5 py-2.5 text-white/50 font-mono">{fmtNum(row.postStats?.totalViews)}</td>
                  <td className="px-3.5 py-2.5 text-white/50 font-mono">{fmtNum(row.postStats?.totalLikes)}</td>
                  <td className="px-3.5 py-2.5 text-white/30 whitespace-nowrap">{fmtDate(row.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-white/[0.06] flex items-center justify-between">
          <span className="text-[10px] text-white/25">Page {page} of {data?.totalPages ?? 1} · {data ? fmtNum(data.total) : "—"} users</span>
          <Pagination page={page} totalPages={data?.totalPages ?? 1} onPage={setPage} />
        </div>
      </GlassCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  POSTS TABLE
// ─────────────────────────────────────────────────────────────
function PostsTable() {
  const { dr } = useDR();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(""); const [qs, setQs] = useState("");
  const [type, setType] = useState("all");
  const [sortBy, setSortBy] = useState("createdAt");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { setQs(search); setPage(1); }, 400);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [search]);

  const params = { ...drToParams(dr), page, pageSize: 20, search: qs || undefined, type: type !== "all" ? type : undefined, sortBy };
  const { data, loading, error, refresh } = usePoller<PaginatedResponse<PostRow>>(
    () => apiFetch("/posts", params), 0, [JSON.stringify(params)]
  );

  const displayName = (row: PostRow) =>
    row.gamePost?.gameName ?? row.modelPost?.title ?? row.adModelPost?.brandName ?? row.mediaAdPost?.brandName ?? row.description ?? "—";

  return (
    <div>
      <SectionHeader title="Post Analytics" sub={data ? `${fmtNum(data.total)} posts` : ""}
        actions={<Btn onClick={refresh} variant="ghost">↻</Btn>} />
      {error && <ErrorBanner message={error} onRetry={refresh} />}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex-1 min-w-[200px]"><SearchInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Search posts…" /></div>
        <SelectFilter value={type} onChange={e => { setType(e.target.value); setPage(1); }}
          options={[
            { value: "all", label: "All Types" },
            ...Object.entries(POST_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v })),
          ]} />
        <SelectFilter value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(1); }}
          options={[
            { value: "createdAt", label: "Newest" },
            { value: "viewsCount", label: "Most Views" },
            { value: "likesCount", label: "Most Liked" },
            { value: "commentsCount", label: "Most Comments" },
            { value: "sharesCount", label: "Most Shared" },
          ]} />
      </div>
      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/[0.07]">
                {["Post","Creator","Type","Views","Unique","Likes","Comments","Shares","Eng Rate","Created"].map(h => (
                  <th key={h} className="px-3.5 py-2.5 text-left text-[10px] text-white/25 font-bold uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? <SkeletonRow cols={10} /> : data?.rows.map((row, i) => {
                const engRate = row.viewsCount > 0
                  ? (((row.likesCount + row.commentsCount + row.sharesCount) / row.uniqueViewsCount) * 100).toFixed(1)
                  : "0.0";
                return (
                  <tr key={row._id} className={`border-b border-white/[0.04] hover:bg-teal-900/5 transition-colors ${i % 2 ? "bg-white/[0.01]" : ""}`}>
                    <td className="px-3.5 py-2.5 max-w-[160px] truncate text-white/80 font-medium">{displayName(row)}</td>
                    <td className="px-3.5 py-2.5 text-teal-400 text-[10px]">{row.creator?.username ?? "—"}</td>
                    <td className="px-3.5 py-2.5">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-white/10 bg-white/5 whitespace-nowrap"
                        style={{ color: POST_TYPE_COLORS[row.type] }}>{POST_TYPE_LABELS[row.type] ?? row.type}</span>
                    </td>
                    <td className="px-3.5 py-2.5 text-white/60 font-mono">{fmtNum(row.viewsCount)}</td>
                    <td className="px-3.5 py-2.5 text-white/40 font-mono">{fmtNum(row.uniqueViewsCount)}</td>
                    <td className="px-3.5 py-2.5 text-white/60 font-mono">{fmtNum(row.likesCount)}</td>
                    <td className="px-3.5 py-2.5 text-white/60 font-mono">{fmtNum(row.commentsCount)}</td>
                    <td className="px-3.5 py-2.5 text-white/60 font-mono">{fmtNum(row.sharesCount)}</td>
                    <td className="px-3.5 py-2.5">
                      <span className={`font-bold font-mono text-[11px] ${parseFloat(engRate) > 3 ? "text-green-400" : parseFloat(engRate) > 1 ? "text-amber-400" : "text-white/30"}`}>{engRate}%</span>
                    </td>
                    <td className="px-3.5 py-2.5 text-white/30 whitespace-nowrap">{fmtDate(row.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-white/[0.06] flex items-center justify-between">
          <span className="text-[10px] text-white/25">Page {page} of {data?.totalPages ?? 1} · {data ? fmtNum(data.total) : "—"} posts</span>
          <Pagination page={page} totalPages={data?.totalPages ?? 1} onPage={setPage} />
        </div>
      </GlassCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  CREATOR RANKINGS
// ─────────────────────────────────────────────────────────────
function CreatorRankings() {
  const { dr } = useDR();
  const [page, setPage] = useState(1);
  const [rankBy, setRankBy] = useState("views");
  const navigate = useNavigate();

  const params = { ...drToParams(dr), page, pageSize: 20, rankBy };
  const { data, loading, error, refresh } = usePoller<PaginatedResponse<CreatorRow>>(
    () => apiFetch("/creators", params), 0, [JSON.stringify(params)]
  );

  return (
    <div>
      <SectionHeader title="Creator Rankings" sub={data ? `${fmtNum(data.total)} creators` : ""}
        actions={<Btn onClick={refresh} variant="ghost">↻</Btn>} />
      {error && <ErrorBanner message={error} onRetry={refresh} />}
      <div className="flex gap-2 mb-4">
        <SelectFilter value={rankBy} onChange={e => { setRankBy(e.target.value); setPage(1); }}
          options={[
            { value: "views", label: "Rank by Views" },
            { value: "likes", label: "Rank by Likes" },
            { value: "followers", label: "Rank by Followers" },
            { value: "posts", label: "Rank by Posts" },
            { value: "sessions", label: "Rank by Sessions Generated" },
          ]} />
      </div>
      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/[0.07]">
                {["#","Creator","Verified","Followers","Posts","Games","Views","Likes","Sessions","Play Time","Joined"].map(h => (
                  <th key={h} className="px-3.5 py-2.5 text-left text-[10px] text-white/25 font-bold uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? <SkeletonRow cols={11} /> : data?.rows.map((row, i) => (
                <tr
                  key={row._id}
                  onClick={() => navigate(`/admin/analytics/${row._id}`)}
                  className={`border-b border-white/[0.04]
                    hover:bg-teal-900/10
                    hover:border-teal-600/20
                    transition-all
                    cursor-pointer
                    ${
                      i % 2 ? "bg-white/[0.01]" : ""
                    }`}
                >
                  <td className="px-3.5 py-2.5 text-white/25 font-mono text-[10px]">{((page - 1) * 20) + i + 1}</td>
                  <td className="px-3.5 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-teal-400">
                        {row.username}
                      </span>

                      <span className="text-white/20 text-[10px]">
                        ↗
                      </span>
                    </div>
                  </td>
                  <td className="px-3.5 py-2.5">{row.isVerified ? <span className="text-green-400 text-[11px]">✓</span> : <span className="text-white/20">—</span>}</td>
                  <td className="px-3.5 py-2.5 text-white/60 font-mono">{fmtNum(row.followersCount)}</td>
                  <td className="px-3.5 py-2.5 text-white/50 font-mono">{fmtNum(row.postsCount)}</td>
                  <td className="px-3.5 py-2.5 text-white/50 font-mono">{fmtNum(row.gamesCount)}</td>
                  <td className="px-3.5 py-2.5 text-white/70 font-mono font-semibold">{fmtNum(row.totalViews)}</td>
                  <td className="px-3.5 py-2.5 text-white/50 font-mono">{fmtNum(row.totalLikes)}</td>
                  <td className="px-3.5 py-2.5 text-white/50 font-mono">{fmtNum(row.totalSessions)}</td>
                  <td className="px-3.5 py-2.5 text-white/40">{fmtDuration(row.totalPlayTime)}</td>
                  <td className="px-3.5 py-2.5 text-white/30 whitespace-nowrap">{fmtDate(row.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-white/[0.06] flex items-center justify-between">
          <span className="text-[10px] text-white/25">Page {page} of {data?.totalPages ?? 1}</span>
          <Pagination page={page} totalPages={data?.totalPages ?? 1} onPage={setPage} />
        </div>
      </GlassCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  GAME INTELLIGENCE
// ─────────────────────────────────────────────────────────────
function GameIntelligence() {
  const { dr } = useDR();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(""); const [qs, setQs] = useState("");
  const [sortBy, setSortBy] = useState("sessions");
  const [snapshotActionId, setSnapshotActionId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { setQs(search); setPage(1); }, 400);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [search]);

  const params = { ...drToParams(dr), page, pageSize: 20, search: qs || undefined, sortBy };
  const { data, loading, error, refresh } = usePoller<PaginatedResponse<GameRow>>(
    () => apiFetch("/games", params), 0, [JSON.stringify(params)]
  );
  

const createOrRetrySnapshots = async (
  postId: string,
  hasSnapshot: boolean
) => {
  try {
    setSnapshotActionId(postId);

    await api.post(
      hasSnapshot
        ? `/games/${postId}/retry-snapshots`
        : `/games/${postId}/create-snapshots`
    );

    await refresh();
  } catch (error) {
    console.error(
      "Snapshot operation failed:",
      error
    );

    const message = axios.isAxiosError(error)
      ? error.response?.data?.message
      : error instanceof Error
        ? error.message
        : "Failed to create snapshots";

    window.alert(message);
  } finally {
    setSnapshotActionId(null);
  }
};

  const statusBadge = (s: string | undefined) => {
    const map: Record<string, string> = {
      active: "bg-green-900/30 text-green-400 border-green-600/30",
      hidden: "bg-white/5 text-white/40 border-white/10",
      credit_exhausted: "bg-amber-900/30 text-amber-400 border-amber-600/30",
    };
    return <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${map[s ?? ""] ?? "bg-white/5 text-white/30 border-white/10"}`}>{s?.replace(/_/g, " ") ?? "—"}</span>;
  };

  const verifyBadge = (s: string | undefined) => {
    const map: Record<string, string> = {
      verified: "text-green-400", pending: "text-amber-400", failed: "text-red-400",
    };
    return <span className={`text-[10px] font-bold ${map[s ?? ""] ?? "text-white/30"}`}>{s ?? "—"}</span>;
  };

  const getSnapshotInfo = (
  game: GameRow
) => {
  const snapshot = game.gamePost?.snapshot;

  if (!snapshot) {
    return {
      status: null,
      failedRegions: [],
      hasFailedRegions: false,
    };
  }

  const failedRegions =
    snapshot.regions?.filter(
      region =>
        region.status !== "ready" ||
        !region.snapshotId
    ) ?? [];

  return {
    status: snapshot.status,
    failedRegions,
    hasFailedRegions:
      failedRegions.length > 0,
  };
};

  return (
    <div>
      <SectionHeader title="Game Intelligence" sub={data ? `${fmtNum(data.total)} games` : ""}
        actions={<div className="flex gap-2">
          <Btn onClick={refresh} variant="ghost">↻</Btn>
          <a href="/admin/sessionsMonitoring" className="inline-flex items-center gap-1.5 rounded-xl font-semibold transition-all duration-150 bg-teal-700/40 border border-teal-600/40 text-teal-300 hover:bg-teal-700/60 px-3 py-1.5 text-[11px]">↗ Session Monitor</a>
        </div>} />
      {error && <ErrorBanner message={error} onRetry={refresh} />}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex-1 min-w-[200px]"><SearchInput value={search} onChange={e => setSearch(e.target.value)} placeholder="Search game…" /></div>
        <SelectFilter value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(1); }}
          options={[
            { value: "sessions", label: "Most Sessions" },
            { value: "players", label: "Most Players" },
            { value: "credits", label: "Credits Used" },
            { value: "failureRate", label: "Failure Rate" },
            { value: "views", label: "Most Views" },
          ]} />
      </div>
      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/[0.07]">
                {["Game","Creator","Sessions","Players","Play Time","Credits","Failure","Crash","Verification","Visibility","Snapshots","Views" ,"Actions"].map(h => (
                  <th key={h} className="px-3.5 py-2.5 text-left text-[10px] text-white/25 font-bold uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? <SkeletonRow cols={13} /> : data?.rows.map((row, i) => {
                const ss = row.sessionStats;
                const snapshotInfo = getSnapshotInfo(row);
                return (
                  <tr key={row._id} className={`border-b border-white/[0.04] hover:bg-teal-900/5 transition-colors ${i % 2 ? "bg-white/[0.01]" : ""}`}>
                    <td className="px-3.5 py-2.5 font-semibold text-white/90">{row.gamePost?.gameName ?? "—"}</td>
                    <td className="px-3.5 py-2.5 text-teal-400 text-[10px]">{row.creator?.username ?? "—"}</td>
                    <td className="px-3.5 py-2.5 text-white/70 font-mono font-semibold">{fmtNum(ss?.totalSessions)}</td>
                    <td className="px-3.5 py-2.5 text-white/50 font-mono">{fmtNum(ss?.uniquePlayers)}</td>
                    <td className="px-3.5 py-2.5 text-white/40">{fmtDuration(ss?.totalPlayTime)}</td>
                    <td className="px-3.5 py-2.5 text-amber-400 font-mono">{fmtNum(ss?.totalCredits)}</td>
                    <td className="px-3.5 py-2.5">
                      <span className={`font-bold font-mono ${(ss?.failureRate ?? 0) > 5 ? "text-red-400" : (ss?.failureRate ?? 0) > 2 ? "text-amber-400" : "text-green-400"}`}>
                        {(ss?.failureRate ?? 0).toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5">
                      <span className={`font-bold font-mono ${(ss?.crashRate ?? 0) > 4 ? "text-red-400" : (ss?.crashRate ?? 0) > 1 ? "text-amber-400" : "text-green-400"}`}>
                        {(ss?.crashRate ?? 0).toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5">{verifyBadge(row.gamePost?.verification?.status)}</td>
                    <td className="px-3.5 py-2.5">{statusBadge(row.gamePost?.visibility)}</td>
                    <td className="px-3.5 py-2.5">
                      {snapshotInfo.status === "ready" ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-green-900/30 text-green-400 border-green-600/30">
                          READY
                        </span>
                      ) : snapshotInfo.status === "failed" ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-red-900/30 text-red-400 border-red-600/30">
                          FAILED
                        </span>
                      ) : snapshotInfo.status === "replicating" ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-amber-900/30 text-amber-400 border-amber-600/30">
                          REPLICATING
                        </span>
                      ) : snapshotInfo.status ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-white/5 text-white/40 border-white/10">
                          {snapshotInfo.status.toUpperCase()}
                        </span>
                      ) : (
                        <span className="text-white/20 text-[10px]">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-white/50 font-mono">{fmtNum(row.viewsCount)}</td>
                    <td className="px-3.5 py-2.5">
                      {snapshotInfo.status === null ? (
                        <Btn
                          variant="teal"
                          size="sm"
                          onClick={() =>
                            createOrRetrySnapshots(row._id, false)
                          }
                          loading={
                            snapshotActionId === row._id
                          }
                        >
                          Create Snapshots
                        </Btn>
                      ) : snapshotInfo.status === "failed" ? (
                        <Btn
                          variant="teal"
                          size="sm"
                          onClick={() =>
                            createOrRetrySnapshots(row._id, true)
                          }
                          loading={
                            snapshotActionId === row._id
                          }
                        >
                          ↻ Retry
                        </Btn>
                      ) : snapshotInfo.status === "replicating" ||
                        snapshotInfo.status === "pending" ||
                        snapshotInfo.status === "creating" ||
                        snapshotInfo.status === "preparing" ? (
                        <span className="text-[9px] text-amber-400/70">
                          Processing…
                        </span>
                      ) : snapshotInfo.status === "ready" ? (
                        <span className="text-[9px] text-green-400/50">
                          ✓ Ready
                        </span>
                      ) : (
                        <span className="text-white/20 text-[10px]">
                          —
                        </span>
                      )}
                      </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-white/[0.06] flex items-center justify-between">
          <span className="text-[10px] text-white/25">Page {page} of {data?.totalPages ?? 1} · {data ? fmtNum(data.total) : "—"} games</span>
          <Pagination page={page} totalPages={data?.totalPages ?? 1} onPage={setPage} />
        </div>
      </GlassCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  MODEL MARKETPLACE
// ─────────────────────────────────────────────────────────────
function ModelMarketplace() {
  const { dr } = useDR();
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("views");

  const params = { ...drToParams(dr), page, pageSize: 20, sortBy };
  const { data, loading, error, refresh } = usePoller<PaginatedResponse<ModelRow>>(
    () => apiFetch("/models", params), 0, [JSON.stringify(params)]
  );

  return (
    <div>
      <SectionHeader title="Model Marketplace Analytics" sub={data ? `${fmtNum(data.total)} models` : ""}
        actions={<Btn onClick={refresh} variant="ghost">↻</Btn>} />
      {error && <ErrorBanner message={error} onRetry={refresh} />}
      <div className="flex gap-2 mb-4">
        <SelectFilter value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(1); }}
          options={[
            { value: "views", label: "Most Views" },
            { value: "likes", label: "Most Liked" },
            { value: "comments", label: "Most Comments" },
            { value: "sharesCount", label: "Most Shared" },
            { value: "purchases", label: "Most Purchased" },
          ]} />
      </div>
      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/[0.07]">
                {["Model","Creator","Price","Views","Unique Views","Likes","Comments","Shares","Assets","Created"].map(h => (
                  <th key={h} className="px-3.5 py-2.5 text-left text-[10px] text-white/25 font-bold uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? <SkeletonRow cols={10} /> : data?.rows.map((row, i) => (
                <tr key={row._id} className={`border-b border-white/[0.04] hover:bg-teal-900/5 transition-colors ${i % 2 ? "bg-white/[0.01]" : ""}`}>
                  <td className="px-3.5 py-2.5 font-semibold text-white/90">{row.modelPost?.title ?? "—"}</td>
                  <td className="px-3.5 py-2.5 text-teal-400 text-[10px]">{row.creator?.username ?? "—"}</td>
                  <td className="px-3.5 py-2.5 text-amber-400 font-mono font-bold">${row.modelPost?.price ?? 0}</td>
                  <td className="px-3.5 py-2.5 text-white/70 font-mono">{fmtNum(row.viewsCount)}</td>
                  <td className="px-3.5 py-2.5 text-white/50 font-mono">{fmtNum(row.uniqueViewsCount)}</td>
                  <td className="px-3.5 py-2.5 text-white/50 font-mono">{fmtNum(row.likesCount)}</td>
                  <td className="px-3.5 py-2.5 text-white/50 font-mono">{fmtNum(row.commentsCount)}</td>
                  <td className="px-3.5 py-2.5 text-white/40 font-mono">{fmtNum(row.sharesCount)}</td>
                  <td className="px-3.5 py-2.5 text-white/40 font-mono">{row.modelPost?.assets ?? "—"}</td>
                  <td className="px-3.5 py-2.5 text-white/30 whitespace-nowrap">{fmtDate(row.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-white/[0.06] flex items-center justify-between">
          <span className="text-[10px] text-white/25">Page {page} of {data?.totalPages ?? 1}</span>
          <Pagination page={page} totalPages={data?.totalPages ?? 1} onPage={setPage} />
        </div>
      </GlassCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  ADVERTISING ANALYTICS
// ─────────────────────────────────────────────────────────────
function AdvertisingAnalytics() {
  const { dr } = useDR();
  const params = drToParams(dr);
  const { data, loading, error, refresh } = usePoller<{ mediaAds: AdBrandRow[]; adModels: AdBrandRow[]; topBrands: AdBrandRow[] }>(
    () => apiFetch("/ads", params), 30_000, [JSON.stringify(params)]
  );

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBanner message={error} onRetry={refresh} />;
  if (!data) return null;

  return (
    <div>
      <SectionHeader title="Advertising Analytics" sub="Media ads and 3D ad model performance"
        actions={<Btn onClick={refresh} variant="ghost">↻</Btn>} />

      {/* Top Brands Chart */}
      {data.topBrands.length > 0 && (
        <GlassCard className="p-4 mb-5">
          <div className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-4">Top Brands by Impressions</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.topBrands} layout="vertical" barSize={12}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
              <XAxis type="number" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmtNum} />
              <YAxis type="category" dataKey="_id" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} width={100} />
              <Tooltip content={<RigzerTooltip />} />
              <Bar dataKey="totalImpressions" name="Impressions" fill="#3D7A6E" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>
      )}

      <SubSection label="Media Ads" />
      <GlassCard className="overflow-hidden mb-5">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/[0.07]">
                {["Brand","Impressions","Clicks","CTR","Views","Likes","Ad Count"].map(h => (
                  <th key={h} className="px-3.5 py-2.5 text-left text-[10px] text-white/25 font-bold uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.mediaAds.map((row, i) => (
                <tr key={row._id} className={`border-b border-white/[0.04] ${i % 2 ? "bg-white/[0.01]" : ""}`}>
                  <td className="px-3.5 py-2.5 font-semibold text-white/90">{row._id || "Unknown"}</td>
                  <td className="px-3.5 py-2.5 text-teal-400 font-mono font-semibold">{fmtNum(row.impressions)}</td>
                  <td className="px-3.5 py-2.5 text-white/60 font-mono">{fmtNum(row.clicks)}</td>
                  <td className="px-3.5 py-2.5"><span className={`font-bold font-mono ${(row.ctr ?? 0) > 2 ? "text-green-400" : "text-amber-400"}`}>{(row.ctr ?? 0).toFixed(2)}%</span></td>
                  <td className="px-3.5 py-2.5 text-white/50 font-mono">{fmtNum(row.views)}</td>
                  <td className="px-3.5 py-2.5 text-white/50 font-mono">{fmtNum(row.likes)}</td>
                  <td className="px-3.5 py-2.5 text-white/40 font-mono">{row.count}</td>
                </tr>
              ))}
              {data.mediaAds.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-white/25 text-[12px]">No media ad data for this period</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <SubSection label="3D Ad Models" />
      <GlassCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/[0.07]">
                {["Brand","Views","Unique Views","Likes","Ad Count"].map(h => (
                  <th key={h} className="px-3.5 py-2.5 text-left text-[10px] text-white/25 font-bold uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.adModels.map((row, i) => (
                <tr key={row._id} className={`border-b border-white/[0.04] ${i % 2 ? "bg-white/[0.01]" : ""}`}>
                  <td className="px-3.5 py-2.5 font-semibold text-white/90">{row._id || "Unknown"}</td>
                  <td className="px-3.5 py-2.5 text-teal-400 font-mono font-semibold">{fmtNum(row.views)}</td>
                  <td className="px-3.5 py-2.5 text-white/50 font-mono">{fmtNum(row.uniqueViews)}</td>
                  <td className="px-3.5 py-2.5 text-white/50 font-mono">{fmtNum(row.likes)}</td>
                  <td className="px-3.5 py-2.5 text-white/40 font-mono">{row.count}</td>
                </tr>
              ))}
              {data.adModels.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-white/25 text-[12px]">No 3D ad model data for this period</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  DISCOVERY
// ─────────────────────────────────────────────────────────────
function DiscoveryAnalytics() {
  const { dr } = useDR();
  const params = drToParams(dr);
  const { data, loading, error, refresh } = usePoller<{
    topPosts: (PostRow & { creator?: { username: string } })[],
    topGames: (GameRow & { sessionCount?: { sessions: number }[] })[],
    topCreators: (CreatorRow & { stats?: { totalViews: number; postsCount: number } })[],
  }>(
    () => apiFetch("/discovery", params), 300_000, [JSON.stringify(params)]
  );

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBanner message={error} onRetry={refresh} />;
  if (!data) return null;

  const Rank = ({ n }: { n: number }) => (
    <span className="text-[11px] font-mono text-white/20 w-5 text-right shrink-0">{n}</span>
  );

  return (
    <div>
      <SectionHeader title="Discovery Analytics" sub="What users are discovering on the platform"
        actions={<Btn onClick={refresh} variant="ghost">↻</Btn>} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top Posts */}
        <GlassCard className="overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <div className="text-[11px] font-bold text-white/40 uppercase tracking-widest">Most Discovered Posts</div>
          </div>
          {data.topPosts.map((post, i) => (
            <div key={post._id} className="flex items-center gap-2.5 px-4 py-2.5 border-b border-white/[0.04] hover:bg-white/[0.02]">
              <Rank n={i + 1} />
              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-white/80 font-medium truncate">
                  {post.gamePost?.gameName ?? post.modelPost?.title ?? (post.description || "Post")}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[9px] text-white/30">{post.creator?.username ?? "—"}</span>
                  <span className="text-[9px]" style={{ color: POST_TYPE_COLORS[post.type] }}>{POST_TYPE_LABELS[post.type] ?? post.type}</span>
                </div>
              </div>
              <span className="text-[11px] text-teal-400 font-mono shrink-0">{fmtNum(post.viewsCount)}</span>
            </div>
          ))}
        </GlassCard>

        {/* Top Games */}
        <GlassCard className="overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <div className="text-[11px] font-bold text-white/40 uppercase tracking-widest">Most Discovered Games</div>
          </div>
          {data.topGames.map((game, i) => (
            <div key={game._id} className="flex items-center gap-2.5 px-4 py-2.5 border-b border-white/[0.04] hover:bg-white/[0.02]">
              <Rank n={i + 1} />
              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-white/80 font-medium truncate">{game.gamePost?.gameName ?? "—"}</div>
                <div className="text-[9px] text-white/30 mt-0.5">{game.creator?.username ?? "—"}</div>
              </div>
              <span className="text-[11px] text-teal-400 font-mono shrink-0">{fmtNum(game.viewsCount)}</span>
            </div>
          ))}
        </GlassCard>

        {/* Top Creators */}
        <GlassCard className="overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <div className="text-[11px] font-bold text-white/40 uppercase tracking-widest">Most Discovered Creators</div>
          </div>
          {data.topCreators.map((creator, i) => (
            <div key={creator._id} className="flex items-center gap-2.5 px-4 py-2.5 border-b border-white/[0.04] hover:bg-white/[0.02]">
              <Rank n={i + 1} />
              <div className="w-7 h-7 rounded-full bg-teal-900/40 border border-teal-600/30 flex items-center justify-center text-[10px] font-bold text-teal-400 shrink-0">
                {creator.username.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-white/80 font-medium truncate">{creator.username}</div>
                <div className="text-[9px] text-white/30 mt-0.5">{fmtNum(creator.followersCount)} followers</div>
              </div>
              <span className="text-[11px] text-teal-400 font-mono shrink-0">{fmtNum(creator.stats?.totalViews)}</span>
            </div>
          ))}
        </GlassCard>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  ALERTS CENTER
// ─────────────────────────────────────────────────────────────
function AlertsCenter() {
  const { data, loading, error, refresh } = usePoller<Alert[]>(
    () => apiFetch("/alerts"), 30_000, []
  );

  const severityMap: Record<string, { bg: string; border: string; color: string; icon: string }> = {
    critical: { bg: "bg-red-900/20",    border: "border-red-600/25",    color: "text-red-400",    icon: "⚠" },
    warning:  { bg: "bg-amber-900/15",  border: "border-amber-600/25",  color: "text-amber-400",  icon: "⚡" },
    info:     { bg: "bg-blue-900/15",   border: "border-blue-600/25",   color: "text-blue-400",   icon: "ℹ" },
  };

  return (
    <div>
      <SectionHeader title="Alerts Center" sub="Auto-detected platform issues and anomalies"
        actions={<Btn onClick={refresh} variant="ghost">↻</Btn>} />
      {error && <ErrorBanner message={error} onRetry={refresh} />}
      {loading && !data && <Spinner />}
      {data?.length === 0 && (
        <GlassCard className="p-8 text-center">
          <div className="text-2xl mb-2 opacity-20">✓</div>
          <div className="text-[13px] text-white/40">No alerts detected — platform is healthy</div>
        </GlassCard>
      )}
      <div className="flex flex-col gap-3">
        {data?.map((alert, i) => {
          const s = severityMap[alert.severity] ?? severityMap.info;
          return (
            <div key={i} className={`rounded-2xl border p-4 ${s.bg} ${s.border}`}>
              <div className="flex items-start gap-3">
                <span className={`text-lg leading-none mt-0.5 ${s.color}`}>{s.icon}</span>
                <div className="flex-1">
                  <div className={`text-[13px] font-bold mb-1 ${s.color}`}>{alert.title}</div>
                  <div className="text-[12px] text-white/50">{alert.body}</div>
                  {alert.items && alert.items.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {alert.items.slice(0, 5).map((item, j) => (
                        <span key={j} className="text-[10px] bg-white/[0.06] border border-white/10 px-2 py-0.5 rounded-lg text-white/50">
                          {item.gamePost?.gameName ?? item.gameName ?? "Unknown"}
                          {item.failureRate !== undefined && <span className="text-red-400 ml-1">{item.failureRate.toFixed(1)}%</span>}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg border ${s.bg} ${s.border} ${s.color}`}>{alert.severity}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  ROOT DASHBOARD
// ─────────────────────────────────────────────────────────────
export default function AdminIntelligenceCenter() {
  const [activeSection, setActiveSection] = useState<NavId>("overview");
  const [sidebarOpen, setSidebarOpen]     = useState(true);
  const [clock, setClock]                 = useState(() => new Date().toLocaleTimeString());
  const [dr, setDr]                       = useState<DateRange>({ range: "30d" });
  const [alertCount, setAlertCount]       = useState(0);

  useEffect(() => {
    const id = setInterval(() => setClock(new Date().toLocaleTimeString()), 1_000);
    return () => clearInterval(id);
  }, []);

  // Poll alert count for sidebar badge
  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const data = await apiFetch<Alert[]>("/alerts");
        setAlertCount(data.filter(a => a.severity === "critical").length);
      } catch { /* ignore */ }
    };
    fetchAlerts();
    const id = setInterval(fetchAlerts, 30_000);
    return () => clearInterval(id);
  }, []);

  const renderSection = () => {
    switch (activeSection) {
      case "overview":   return <ExecutiveOverview />;
      case "growth":     return <GrowthAnalytics />;
      case "users":      return <UsersTable />;
      case "posts":      return <PostsTable />;
      case "creators":   return <CreatorRankings />;
      case "games":      return <GameIntelligence />;
      case "models":     return <ModelMarketplace />;
      case "ads":        return <AdvertisingAnalytics />;
      case "discovery":  return <DiscoveryAnalytics />;
      case "alerts":     return <AlertsCenter />;
      default:           return <ExecutiveOverview />;
    }
  };

  return (
    <DRCtx.Provider value={{ dr, setDr }}>
      <div className="min-h-screen flex" style={{ backgroundColor: "#0d0d0d", color: "rgba(255,255,255,0.9)", fontFamily: "'Inter',system-ui,sans-serif" }}>

        {/* ── Sidebar ── */}
        <div className={`shrink-0 flex flex-col transition-all duration-300 ${sidebarOpen ? "w-[220px]" : "w-[60px]"}`}
          style={{ backgroundColor: "#0e0e0e", borderRight: "1px solid rgba(255,255,255,0.05)" }}>

          {/* Logo */}
          <div className="px-4 py-5 border-b border-white/[0.05] flex items-center justify-between">
            {sidebarOpen && (
              <div className="flex items-center gap-2">
                <div className="w-1 h-5 rounded-sm bg-teal-600" />
                <div>
                  <div className="text-[13px] font-extrabold text-white/90 leading-none">RIGZER</div>
                  <div className="text-[9px] text-white/30 uppercase tracking-widest">Intelligence</div>
                </div>
              </div>
            )}
            <button onClick={() => setSidebarOpen(p => !p)}
              className="text-white/25 hover:text-white/60 transition-colors bg-transparent border-none cursor-pointer text-sm ml-auto">
              {sidebarOpen ? "←" : "→"}
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 py-3">
            {NAV_SECTIONS.map(item => {
              const active = activeSection === item.id;
              const isAlerts = item.id === "alerts";
              return (
                <button key={item.id} onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all duration-150 cursor-pointer border-none relative ${active ? "bg-teal-900/20 text-teal-400" : "text-white/30 hover:text-white/60 hover:bg-white/[0.03] bg-transparent"}`}>
                  {active && <div className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r-full bg-teal-600" />}
                  <span className="text-sm shrink-0">{item.icon}</span>
                  {sidebarOpen && (
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-[12px] font-semibold whitespace-nowrap">{item.label}</span>
                      {isAlerts && alertCount > 0 && (
                        <span className="ml-auto text-[9px] font-bold bg-red-900/60 text-red-400 border border-red-600/30 px-1.5 py-0.5 rounded-full">
                          {alertCount}
                        </span>
                      )}
                    </div>
                  )}
                  {!sidebarOpen && isAlerts && alertCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Links to other modules */}
          {sidebarOpen && (
            <div className="px-4 py-3 border-t border-white/[0.05] flex flex-col gap-1.5">
              <div className="text-[9px] text-white/20 uppercase tracking-widest mb-1">Deep Dive Modules</div>
              {[
                { label: "Session Monitor",   href: "/admin/sessionsMonitoring" },
              ].map(({ label, href }) => (
                <a key={href} href={href}
                  className="flex items-center gap-1.5 text-[11px] text-white/30 hover:text-teal-400 transition-colors no-underline">
                  <span className="text-[10px]">↗</span>{label}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* ── Main ── */}
        <div className="flex-1 overflow-auto">
          {/* Topbar */}
          <div className="sticky top-0 z-10 px-6 py-3 flex items-center justify-between gap-4"
            style={{ backgroundColor: "rgba(13,13,13,0.9)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="text-[13px] font-semibold text-white/60 whitespace-nowrap">
              {NAV_SECTIONS.find(n => n.id === activeSection)?.label}
            </div>
            <div className="flex items-center gap-3">
              <DateRangePicker />
              <div className="text-[10px] text-white/20 font-mono hidden sm:block">{clock}</div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 max-w-[1440px]">
            {renderSection()}
          </div>
        </div>
      </div>
    </DRCtx.Provider>
  );
}