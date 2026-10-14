import { useEffect, useRef, useState, type ReactNode } from "react";
import { GAME_DETAILS, type GameDetailData, type MediaItem } from "./gameData";
import { Icon } from "./Icon";
import { Embers, Scene, THEMES, type LibraryGame } from "./scenes";

interface Props {
  game: LibraryGame;
  wishlisted: boolean;
  onToggleWishlist: () => void;
  onBack: () => void;
}

const GOLD_BG = "bg-[#ecc98c]";
const glass = "rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl";
const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-[#ecc98c] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0d13]";

/* -------------------------------------------------------------------------- */
/*  Small pieces                                                              */
/* -------------------------------------------------------------------------- */

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

function SectionTitle({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="mb-5 flex items-baseline gap-3">
      <h2 id={id} className="text-xl font-bold tracking-tight text-[#f6efe2]">
        {children}
      </h2>
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#ecc98c]/70">{label}</span>
    </div>
  );
}

function MediaFrame({ game, item, className = "" }: { game: LibraryGame; item: MediaItem; className?: string }) {
  const [zoom, ox, oy] = item.crop;
  return (
    <div className={`relative overflow-hidden ${THEMES[game.theme]} ${className}`}>
      <div className="absolute inset-0" style={{ transform: `scale(${zoom})`, transformOrigin: `${ox}% ${oy}%` }}>
        <Scene scene={game.scene} />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
    </div>
  );
}

function Modal({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      opener?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 sm:p-8" role="dialog" aria-modal="true" aria-label={label}>
      <div className="scrim-in absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      <div ref={ref} tabIndex={-1} className="modal-in relative w-full max-w-5xl outline-none">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className={`absolute -top-12 right-0 grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/10 text-white/80 backdrop-blur-md hover:bg-white/20 ${focusRing}`}
        >
          <Icon name="close" />
        </button>
        {children}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Lightbox                                                                  */
/* -------------------------------------------------------------------------- */

function Lightbox({
  game,
  items,
  start,
  onClose,
  onTrailer,
}: {
  game: LibraryGame;
  items: MediaItem[];
  start: number;
  onClose: () => void;
  onTrailer: () => void;
}) {
  const [i, setI] = useState(start);
  const step = (d: number) => setI((v) => (v + d + items.length) % items.length);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  const item = items[i];

  return (
    <Modal label={`${game.title} media`} onClose={onClose}>
      <div className="relative overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/70">
        <MediaFrame game={game} item={item} className="aspect-video w-full" />

        {item.kind === "video" && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onTrailer();
            }}
            className={`absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/25 bg-black/40 text-white backdrop-blur-md transition-transform hover:scale-105 ${focusRing}`}
            aria-label="Play trailer"
          >
            <Icon name="play" className="ml-0.5 h-6 w-6" />
          </button>
        )}

        {(["left", "right"] as const).map((dir) => (
          <button
            key={dir}
            type="button"
            onClick={() => step(dir === "left" ? -1 : 1)}
            aria-label={dir === "left" ? "Previous" : "Next"}
            className={`absolute top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/15 bg-black/35 text-white/90 backdrop-blur-md hover:bg-black/55 ${focusRing} ${
              dir === "left" ? "left-3" : "right-3"
            }`}
          >
            <Icon name={dir} className="h-5 w-5" />
          </button>
        ))}

        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-gradient-to-t from-black/75 to-transparent p-5">
          <p className="text-sm text-white/90">{item.caption}</p>
          <span className="shrink-0 text-xs tabular-nums text-white/55">
            {i + 1} / {items.length}
          </span>
        </div>
      </div>

      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
        {items.map((m, idx) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setI(idx)}
            aria-label={m.caption}
            aria-current={idx === i}
            className={`shrink-0 overflow-hidden rounded-lg border-2 transition-opacity ${focusRing} ${
              idx === i ? "border-[#ecc98c] opacity-100" : "border-transparent opacity-50 hover:opacity-90"
            }`}
          >
            <MediaFrame game={game} item={m} className="h-14 w-24" />
          </button>
        ))}
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/*  Trailer                                                                   */
/* -------------------------------------------------------------------------- */

function TrailerModal({ game, data, onClose }: { game: LibraryGame; data: GameDetailData; onClose: () => void }) {
  const duration = data.trailerSeconds;
  const [playing, setPlaying] = useState(true);
  const [t, setT] = useState(0);

  useEffect(() => {
    if (!playing || data.trailerUrl) return;
    const id = window.setInterval(() => setT((v) => Math.min(v + 0.25, duration)), 250);
    return () => window.clearInterval(id);
  }, [playing, duration, data.trailerUrl]);

  useEffect(() => {
    if (t >= duration) setPlaying(false);
  }, [t, duration]);

  const toggle = () => {
    if (!playing && t >= duration) setT(0);
    setPlaying((p) => !p);
  };

  const progress = t / duration;

  return (
    <Modal label={`${game.title} trailer`} onClose={onClose}>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl shadow-black/70">
        {data.trailerUrl ? (
          <video src={data.trailerUrl} autoPlay controls className="aspect-video w-full bg-black" />
        ) : (
          <>
            <div className={`relative aspect-video overflow-hidden ${THEMES[game.theme]}`}>
              {/* slow push-in, driven by playback position */}
              <div className="absolute inset-0" style={{ transform: `scale(${1 + progress * 0.35})`, transformOrigin: "74% 42%" }}>
                <Scene scene={game.scene} />
                <Embers />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />
              <div
                className="absolute bottom-10 left-8 transition-opacity duration-700"
                style={{ opacity: t < 4 ? 1 : 0 }}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ecc98c]">{data.genres[0]}</p>
                <p className="mt-1 text-3xl font-black text-white sm:text-4xl">{game.title}</p>
              </div>
              <button
                type="button"
                onClick={toggle}
                aria-label={playing ? "Pause" : "Play"}
                className="absolute inset-0 cursor-pointer outline-none"
              />
            </div>

            <div className="flex items-center gap-4 bg-[#0e1017] px-4 py-3">
              <button
                type="button"
                onClick={toggle}
                aria-label={playing ? "Pause" : "Play"}
                className={`grid h-9 w-9 place-items-center rounded-full ${GOLD_BG} text-[#1a1208] ${focusRing}`}
              >
                <Icon name={playing ? "pause" : "play"} className="h-4 w-4" />
              </button>
              <span className="w-10 text-xs tabular-nums text-white/60">{formatTime(t)}</span>
              <input
                type="range"
                min={0}
                max={duration}
                step={0.25}
                value={t}
                onChange={(e) => setT(Number(e.target.value))}
                aria-label="Seek"
                className="h-1 flex-1 cursor-pointer accent-[#ecc98c]"
              />
              <span className="w-10 text-right text-xs tabular-nums text-white/60">{formatTime(duration)}</span>
            </div>
          </>
        )}
      </div>
      {!data.trailerUrl && (
        <p className="mt-3 text-center text-xs text-white/40">
          Placeholder reel. Set <code className="text-white/60">trailerUrl</code> on this game to play a real video.
        </p>
      )}
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function GameDetail({ game, wishlisted, onToggleWishlist, onBack }: Props) {
  const data = GAME_DETAILS[game.id];

  const [playState, setPlayState] = useState<"idle" | "launching" | "running">("idle");
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [reqTab, setReqTab] = useState<"minimum" | "recommended">("minimum");
  const timers = useRef<number[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach((id) => window.clearTimeout(id));
    },
    [],
  );

  if (!data) {
    return (
      <div className="px-8 pt-28 text-white/60">
        No details for this game yet.{" "}
        <button type="button" className="text-[#ecc98c] underline" onClick={onBack}>
          Back to library
        </button>
      </div>
    );
  }

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const onPlay = () => {
    if (playState === "launching") return;
    if (playState === "running") return setPlayState("idle");
    setPlayState("launching");
    later(() => setPlayState("running"), 1800);
  };

  const onShare = async () => {
    const url = `${window.location.origin}${window.location.pathname}#/game/${game.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareMsg("Link copied");
    } catch {
      setShareMsg("Couldn't copy");
    }
    later(() => setShareMsg(null), 1800);
  };

  const req = data.requirements[reqTab];
  const reqRows: [string, string][] = [
    ["OS", req.os],
    ["Processor", req.cpu],
    ["Graphics", req.gpu],
    ["Memory", req.ram],
    ["Storage", req.storage],
  ];

  const scoreTone =
    data.metascore >= 75
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
      : "border-amber-400/30 bg-amber-400/10 text-amber-300";

  const stats: { label: string; value: ReactNode; sub: string; icon: "star" | "users" | "clock" | "drive" }[] = [
    { label: "User rating", value: `${data.userRating}%`, sub: `${data.reviewCount} reviews`, icon: "star" },
    {
      label: "Metascore",
      value: <span className={`rounded-md border px-2 py-0.5 text-xl ${scoreTone}`}>{data.metascore}</span>,
      sub: "Critic average",
      icon: "users",
    },
    {
      label: "Your playtime",
      value: game.hoursPlayed > 0 ? `${game.hoursPlayed} hrs` : "None yet",
      sub: game.hoursPlayed > 0 ? "Across all sessions" : "Not played yet",
      icon: "clock",
    },
    { label: "Install size", value: `${data.storageGb} GB`, sub: "On disk", icon: "drive" },
  ];

  return (
    <div className="relative">
      {/* Fixed backdrop. Sits behind everything and stays put while the page scrolls. */}

{/* Fixed backdrop */}
<div
  aria-hidden="true"
  className="hero-fade pointer-events-none fixed inset-0 z-0"
>
  <div className={`absolute inset-0 ${THEMES[game.theme]}`} />

  <div
    className="absolute inset-0 opacity-30"
    style={{
      maskImage:
        "linear-gradient(to bottom, #000 0%, #000 40%, transparent 88%)",
      WebkitMaskImage:
        "linear-gradient(to bottom, #000 0%, #000 40%, transparent 88%)",
    }}
  >
    <Scene scene={game.scene} />
    <Embers />
  </div>

  <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(11,13,19,0.25)_0%,rgba(11,13,19,0.65)_45%,#0b0d13_82%)]" />

  <div className="absolute inset-0 bg-[radial-gradient(90%_70%_at_0%_100%,#0b0d13_45%,transparent_75%)]" />
</div>


      <div className="relative z-10">
        {/* ------------------------------ Hero ------------------------------ */}
        <section className="mx-auto max-w-[1280px] px-5 pb-2 pt-6 sm:px-8 lg:min-h-[640px]">
          <button
            type="button"
            onClick={onBack}
            className={`mb-10 inline-flex items-center gap-1.5 rounded-lg py-1 pr-2 text-sm text-white/55 transition-colors hover:text-white ${focusRing}`}
          >
            <Icon name="left" className="h-4 w-4" />
            Library
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {data.genres.map((g) => (
              <span key={g} className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-xs font-medium text-white/80 backdrop-blur-md">
                {g}
              </span>
            ))}
            <span className="mx-1 h-4 w-px bg-white/15" />
            <span
              title={data.esrb.descriptors}
              className="grid h-7 min-w-7 place-items-center rounded-[5px] border-2 border-white/80 px-1 text-[13px] font-black leading-none text-white"
            >
              {data.esrb.rating}
            </span>
            <span className="text-xs text-white/55">{data.esrb.descriptors}</span>
            <span className="mx-1 h-4 w-px bg-white/15" />
            <span className="text-xs tabular-nums text-white/55">{data.year}</span>
          </div>

          <h1 className="mt-5 max-w-4xl text-5xl font-black leading-[0.98] tracking-tight text-[#f7f0e3] sm:text-6xl lg:text-7xl">
            {game.title}
          </h1>
          <span className="mt-4 block h-[3px] w-24 rounded-full bg-orange-500/90" />
          <p className="mt-5 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg">{data.tagline}</p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onPlay}
              disabled={playState === "launching"}
              className={`inline-flex h-12 min-w-[10.5rem] items-center justify-center gap-2 rounded-xl px-6 text-[15px] font-bold transition-[transform,background-color] active:scale-[0.98] disabled:cursor-wait ${focusRing} ${
                playState === "running"
                  ? "border border-[#ecc98c]/40 bg-[#ecc98c]/10 text-[#ecc98c]"
                  : `${GOLD_BG} text-[#1a1208] hover:bg-[#f2d5a2]`
              }`}
            >
              {playState === "idle" && (
                <>
                  <Icon name="play" className="h-4 w-4" /> Play Now
                </>
              )}
              {playState === "launching" && (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#1a1208]/30 border-t-[#1a1208]" /> Launching
                </>
              )}
              {playState === "running" && (
                <>
                  <Icon name="stop" className="h-3.5 w-3.5" /> Running, stop
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setTrailerOpen(true)}
              className={`inline-flex h-12 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.07] px-5 text-[15px] font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/[0.12] ${focusRing}`}
            >
              <Icon name="play" className="h-4 w-4" /> Watch Trailer
            </button>

            <button
              type="button"
              onClick={onToggleWishlist}
              aria-pressed={wishlisted}
              className={`inline-flex h-12 items-center gap-2 rounded-xl border px-5 text-[15px] font-semibold backdrop-blur-md transition-colors ${focusRing} ${
                wishlisted
                  ? "border-[#ecc98c]/50 bg-[#ecc98c]/10 text-[#ecc98c]"
                  : "border-white/15 bg-white/[0.07] text-white hover:bg-white/[0.12]"
              }`}
            >
              <Icon name="heart" filled={wishlisted} className="h-4 w-4" />
              {wishlisted ? "Wishlisted" : "Wishlist"}
            </button>

            <button
              type="button"
              onClick={onShare}
              className={`inline-flex h-12 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.07] px-4 text-[15px] font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/[0.12] ${focusRing}`}
            >
              <Icon name="share" className="h-4 w-4" />
              <span aria-live="polite">{shareMsg ?? "Share"}</span>
            </button>
          </div>

          {/* quick stats */}
          <dl className={`mt-10 grid grid-cols-2 overflow-hidden lg:grid-cols-4 ${glass} [&>div]:border-white/10 lg:[&>div+div]:border-l max-lg:[&>div:nth-child(even)]:border-l max-lg:[&>div:nth-child(n+3)]:border-t`}>
            {stats.map((s) => (
              <div key={s.label} className="flex items-center gap-4 px-5 py-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-[#ecc98c]">
                  <Icon name={s.icon} className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0">
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">{s.label}</dt>
                  <dd className="mt-0.5 text-xl font-bold tabular-nums text-white">{s.value}</dd>
                  <p className="text-xs text-white/40">{s.sub}</p>
                </div>
              </div>
            ))}
          </dl>
        </section>

        {/* ------------------------------ Content --------------------------- */}
        <div className="mx-auto grid max-w-[1280px] gap-8 px-5 pb-20 sm:px-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-10">
          {/* Left column */}
          <div className="min-w-0 space-y-14">
            <section aria-labelledby="about">
              <SectionTitle id="about" label="Overview">
                About this game
              </SectionTitle>
              <div className="max-w-2xl space-y-4 text-[15px] leading-7 text-white/70">
                {data.about.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </section>

            <section aria-labelledby="media">
              <SectionTitle id="media" label={`${data.media.length} items`}>
                Media
              </SectionTitle>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {data.media.map((m, i) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setLightbox(i)}
                    aria-label={`Preview: ${m.caption}`}
                    className={`group relative overflow-hidden rounded-xl border border-white/10 text-left ${focusRing} ${
                      i === 0 ? "col-span-2 aspect-[2/1] sm:aspect-auto sm:row-span-2" : "aspect-video"
                    }`}
                  >
                    <MediaFrame
                      game={game}
                      item={m}
                      className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                    {m.kind === "video" && (
                      <span className="absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/25 bg-black/40 text-white backdrop-blur-md">
                        <Icon name="play" className="ml-0.5 h-5 w-5" />
                      </span>
                    )}
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-6 text-xs text-white/85 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                      {m.caption}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section aria-labelledby="features">
              <SectionTitle id="features" label="What stands out">
                Key features
              </SectionTitle>
              <ul className="grid gap-3 sm:grid-cols-2">
                {data.features.map((f, i) => (
                  <li key={f.title} className={`${glass} p-5`}>
                    <span className="text-xs font-semibold tabular-nums text-[#ecc98c]/70">{String(i + 1).padStart(2, "0")}</span>
                    <h3 className="mt-2 text-[15px] font-semibold text-[#f6efe2]">{f.title}</h3>
                    <p className="mt-1.5 text-sm leading-6 text-white/55">{f.body}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="sysreq">
              <SectionTitle id="sysreq" label="PC">
                System requirements
              </SectionTitle>
              <div className={`${glass} overflow-hidden`}>
                <div
                  role="tablist"
                  aria-label="Requirement level"
                  className="flex border-b border-white/10"
                  onKeyDown={(e) => {
                    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                      setReqTab((t) => (t === "minimum" ? "recommended" : "minimum"));
                    }
                  }}
                >
                  {(["minimum", "recommended"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      id={`req-tab-${tab}`}
                      aria-selected={reqTab === tab}
                      aria-controls="req-panel"
                      tabIndex={reqTab === tab ? 0 : -1}
                      onClick={() => setReqTab(tab)}
                      className={`relative px-6 py-3.5 text-sm font-semibold capitalize outline-none transition-colors focus-visible:bg-white/[0.06] ${
                        reqTab === tab ? "text-[#ecc98c]" : "text-white/45 hover:text-white/75"
                      }`}
                    >
                      {tab}
                      {reqTab === tab && <span className="absolute inset-x-4 bottom-0 h-[2px] rounded-full bg-[#ecc98c]" />}
                    </button>
                  ))}
                </div>
                <dl id="req-panel" role="tabpanel" aria-labelledby={`req-tab-${reqTab}`} className="divide-y divide-white/[0.07]">
                  {reqRows.map(([k, v]) => (
                    <div key={k} className="grid grid-cols-[110px_1fr] gap-4 px-6 py-3.5 text-sm">
                      <dt className="text-white/40">{k}</dt>
                      <dd className="text-white/85">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </section>
          </div>

          {/* Right column */}
          <aside className="min-w-0 space-y-6">
            <section aria-labelledby="studio" className={`${glass} p-6`}>
              <p id="studio" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#ecc98c]/70">
                Studio
              </p>

              <div className="mt-4 flex items-center gap-4">
                <div className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-white/10 text-xl font-black text-[#ecc98c] ${THEMES[game.theme]}`}>
                  {data.studio.initials}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="truncate text-lg font-bold text-[#f6efe2]">{data.studio.name}</h3>
                    {data.studio.verified && (
                      <span title="Verified studio" className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-[#ecc98c] text-[#1a1208]">
                        <Icon name="check" className="h-3 w-3" />
                        <span className="sr-only">Verified</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/45">
                    {data.studio.location} · Est. {data.studio.founded}
                  </p>
                </div>
              </div>

              <p className="mt-4 text-sm leading-6 text-white/60">{data.studio.bio}</p>

              <h4 className="mb-2 mt-6 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">Key team</h4>
              <ul className="divide-y divide-white/[0.07] rounded-xl border border-white/[0.07] bg-black/20">
                {data.studio.team.map((t) => (
                  <li key={t.role} className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm">
                    <span className="text-white/45">{t.role}</span>
                    {t.name ? <span className="text-right text-white/90">{t.name}</span> : <span className="text-white/30">Not credited</span>}
                  </li>
                ))}
              </ul>

              <div className="mt-5 flex flex-wrap gap-2">
                {(
                  [
                    ["Discord", "chat", data.studio.links.discord],
                    ["X", null, data.studio.links.x],
                    ["Website", "globe", data.studio.links.site],
                  ] as const
                ).map(([label, icon, href]) =>
                  href ? (
                    <a
                      key={label}
                      href={href}
                      target="_blank"
                      rel="noreferrer noopener"
                      className={`inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-3 text-[13px] text-white/80 transition-colors hover:bg-white/[0.1] hover:text-white ${focusRing}`}
                    >
                      {icon ? <Icon name={icon} className="h-3.5 w-3.5" /> : <span className="text-[12px] font-bold leading-none">X</span>}
                      {label}
                      <Icon name="external" className="h-3 w-3 text-white/35" />
                    </a>
                  ) : (
                    <span
                      key={label}
                      aria-disabled="true"
                      title="Not linked"
                      className="inline-flex h-9 cursor-not-allowed items-center gap-1.5 rounded-lg border border-white/[0.06] px-3 text-[13px] text-white/25"
                    >
                      {icon ? <Icon name={icon} className="h-3.5 w-3.5" /> : <span className="text-[12px] font-bold leading-none">X</span>}
                      {label}
                    </span>
                  ),
                )}
              </div>

              <h4 className="mb-2 mt-7 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">More titles by {data.studio.name}</h4>
              <ul className="space-y-2">
                {data.studio.titles.map((t, i) => (
                  <li key={t.title} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-black/20 p-2.5">
                    <span
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-xs font-black text-[#ecc98c]/90"
                      style={{ background: `linear-gradient(135deg, hsl(${(i * 47 + 12) % 360} 38% 26%), hsl(${(i * 47 + 40) % 360} 30% 12%))` }}
                    >
                      {t.title
                        .split(" ")
                        .filter((w) => /^[A-Z0-9]/.test(w))
                        .slice(0, 2)
                        .map((w) => w[0])
                        .join("")}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-white/90">{t.title}</span>
                      <span className="block text-xs text-white/40">
                        {t.genre} · {t.year}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="meta" className={`${glass} p-6`}>
              <h3 id="meta" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#ecc98c]/70">
                Details
              </h3>
              <dl className="mt-3 divide-y divide-white/[0.07]">
                {data.details.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 py-2.5 text-sm">
                    <dt className="shrink-0 text-white/40">{k}</dt>
                    <dd className="text-right text-white/85">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section aria-labelledby="activity" className={`${glass} p-6`}>
              <div className="flex items-center justify-between">
                <h3 id="activity" className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#ecc98c]/70">
                  Community
                </h3>
                <span className="flex items-center gap-1.5 text-xs text-white/55">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {data.activity.online} playing now
                </span>
              </div>
              <ul className="mt-4 space-y-4">
                {data.activity.items.map((a) => (
                  <li key={a.user + a.ago} className="flex gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.08] text-[11px] font-bold uppercase text-white/70">
                      {a.user.slice(0, 2)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm leading-5 text-white/70">
                        <span className="font-semibold text-white/90">{a.user}</span> {a.text.charAt(0).toLowerCase() + a.text.slice(1)}
                      </p>
                      <p className="mt-0.5 text-xs text-white/35">{a.ago} ago</p>
                    </div>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className={`mt-5 w-full rounded-xl border border-white/10 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white ${focusRing}`}
              >
                Open community hub
              </button>
            </section>
          </aside>
        </div>
      </div>

      {lightbox !== null && (
        <Lightbox
          game={game}
          items={data.media}
          start={lightbox}
          onClose={() => setLightbox(null)}
          onTrailer={() => setTrailerOpen(true)}
        />
      )}
      {trailerOpen && <TrailerModal game={game} data={data} onClose={() => setTrailerOpen(false)} />}
    </div>
  );
}