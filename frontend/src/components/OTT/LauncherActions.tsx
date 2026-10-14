import React, { useState } from "react";
import { Settings } from "lucide-react";
import { Icon } from "./Icon";
import { Scene, THEMES, type LibraryGame } from "./scenes";

type Menu = "switcher" | "notifications" | "profile" | null;

interface LauncherActionsProps {
  games: LibraryGame[];
  currentId: string | null;
  onOpen: (id: string) => void;
  onToggle: () => void;
  onSettings?: () => void;
  onProfile?: () => void;
  onFriends?: () => void;
  onSignOut?: () => void;
}

const NOTIFICATIONS = [
  { title: "Update queued", body: "Sekiro: Shadows Die Twice, 412 MB", ago: "2h" },
  { title: "Friend is playing", body: "marlowe started It Takes Two", ago: "5h" },
  { title: "Stream starting", body: "Hades speedrun relay is live", ago: "1d" },
];

function Thumb({ game, className = "h-7 w-7" }: { game: LibraryGame; className?: string }) {
  return (
    <span className={`relative shrink-0 overflow-hidden rounded-lg ${THEMES[game.theme]} ${className}`}>
      <Scene scene={game.scene} />
    </span>
  );
}

export function LauncherActions({
  games,
  currentId,
  onOpen,
  onToggle,
  onSettings,
  onProfile,
  onFriends,
  onSignOut,
}: LauncherActionsProps) {
  const [menu, setMenu] = useState<Menu>(null);

  const current = games.find((g) => g.id === currentId) ?? null;

  const pick = (id: string) => {
    setMenu(null);
    onOpen(id);
  };

  const panel =
    "absolute right-0 top-[calc(100%+10px)] z-50 w-72 rounded-2xl border border-white/10 bg-[#11141c]/90 p-1.5 shadow-2xl shadow-black/60 backdrop-blur-2xl";

  return (
    <div className="absolute right-4 top-0 flex h-full items-center gap-2 sm:right-6">
      {menu && <div className="fixed inset-0 z-30" onClick={() => setMenu(null)} aria-hidden="true" />}

      {/* Jump to game dropdown */}
      <div className="relative hidden sm:block">
        <button
          type="button"
          onClick={() => setMenu(menu === "switcher" ? null : "switcher")}
          aria-expanded={menu === "switcher"}
          aria-haspopup="listbox"
          className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] pl-1.5 pr-2.5 text-sm outline-none transition-colors hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-[#ecc98c]"
        >
          {current ? <Thumb game={current} className="h-7 w-7" /> : <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/10 text-white/50"><Icon name="play" className="h-3 w-3" /></span>}
          <span className="max-w-[9rem] truncate text-white/80">{current ? current.title : "Jump to game"}</span>
          <Icon name="down" className="h-3.5 w-3.5 text-white/40" />
        </button>

        {menu === "switcher" && (
          <div role="listbox" aria-label="Switch game" className={panel}>
            {games.map((g) => (
              <button
                key={g.id}
                type="button"
                role="option"
                aria-selected={g.id === currentId}
                onClick={() => pick(g.id)}
                className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left outline-none hover:bg-white/[0.06] focus-visible:bg-white/[0.08]"
              >
                <Thumb game={g} className="h-9 w-9" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-white">{g.title}</span>
                  <span className="block text-xs text-white/45">
                    {g.hoursPlayed > 0 ? `${g.hoursPlayed} hrs played` : "Not played yet"}
                  </span>
                </span>
                {g.id === currentId && <Icon name="check" className="h-4 w-4 text-[#ecc98c]" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Notifications button */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenu(menu === "notifications" ? null : "notifications")}
          aria-label="Notifications, 3 unread"
          aria-expanded={menu === "notifications"}
          className="relative grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.05] text-white/70 outline-none transition-colors hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-[#ecc98c]"
        >
          <Icon name="bell" className="h-[18px] w-[18px]" />
          <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-[#ecc98c] ring-2 ring-[#0b0d13]" />
        </button>
        {menu === "notifications" && (
          <div className={panel}>
            <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">Notifications</p>
            {NOTIFICATIONS.map((n) => (
              <div key={n.title} className="rounded-xl px-3 py-2.5 hover:bg-white/[0.05]">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-white">{n.title}</span>
                  <span className="text-[11px] text-white/35">{n.ago}</span>
                </div>
                <p className="mt-0.5 text-xs text-white/50">{n.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dedicated Settings icon button */}
      <button
        type="button"
        onClick={onSettings}
        title="Settings"
        aria-label="Settings"
        className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.05] text-white/70 outline-none transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-[#ecc98c]"
      >
        <Settings className="h-[18px] w-[18px]" />
      </button>

      {/* Profile avatar & dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenu(menu === "profile" ? null : "profile")}
          aria-label="Account menu"
          aria-expanded={menu === "profile"}
          className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-[#ecc98c] to-[#b5803a] text-[13px] font-bold text-[#1a1208] outline-none ring-2 ring-white/10 transition-shadow hover:ring-white/25 focus-visible:ring-[#ecc98c]"
        >
          NT
        </button>
        {menu === "profile" && (
          <div className={`${panel} w-56`}>
            <div className="px-3 pb-2 pt-2.5">
              <p className="text-sm font-semibold text-white">ashen_fox</p>
              <p className="text-xs text-white/45">Online</p>
            </div>
            <div className="my-1 h-px bg-white/[0.07]" />
            <button
              type="button"
              onClick={() => { setMenu(null); onProfile?.(); }}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-white/70 outline-none hover:bg-white/[0.06] hover:text-white focus-visible:bg-white/[0.08]"
            >
              Profile
            </button>
            <button
              type="button"
              onClick={() => { setMenu(null); onFriends?.(); }}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-white/70 outline-none hover:bg-white/[0.06] hover:text-white focus-visible:bg-white/[0.08]"
            >
              Friends
            </button>
            <button
              type="button"
              onClick={() => { setMenu(null); onSettings?.(); }}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-white/70 outline-none hover:bg-white/[0.06] hover:text-white focus-visible:bg-white/[0.08]"
            >
              Settings
            </button>
            <button
              type="button"
              onClick={() => { setMenu(null); onSignOut?.(); }}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-white/70 outline-none hover:bg-white/[0.06] hover:text-white focus-visible:bg-white/[0.08]"
            >
              Sign out
            </button>
          </div>
        )}
      </div>

      {/* Exit launcher button */}
      <button
        type="button"
        onClick={onToggle}
        title="Exit launcher"
        aria-label="Exit launcher"
        className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-white/70 transition hover:bg-white/[0.08] hover:text-white focus-visible:ring-2 focus-visible:ring-[#ecc98c]"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
        >
          <path d="M9 5H5v14h4" />
          <path d="M13 8l4 4-4 4M17 12H9" />
        </svg>
      </button>
    </div>
  );
}