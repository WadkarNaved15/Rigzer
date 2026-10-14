import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./Icon";
import { Scene, THEMES, type LibraryGame } from "./scenes";

interface LauncherSearchProps {
  games: LibraryGame[];
  onOpen: (id: string) => void;
}

function Thumb({ game, className = "h-9 w-9" }: { game: LibraryGame; className?: string }) {
  return (
    <span className={`relative shrink-0 overflow-hidden rounded-lg ${THEMES[game.theme]} ${className}`}>
      <Scene scene={game.scene} />
    </span>
  );
}

export function LauncherSearch({ games, onOpen }: LauncherSearchProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return games.filter((g) => g.title.toLowerCase().includes(q) || g.genre.toLowerCase().includes(q));
  }, [games, query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const pick = (id: string) => {
    setIsOpen(false);
    setQuery("");
    inputRef.current?.blur();
    onOpen(id);
  };

  return (
    <div className="relative min-w-0 flex-1">
      {isOpen && <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} aria-hidden="true" />}

      <label className="relative block">
        <span className="sr-only">Search your library</span>
        <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results[0]) pick(results[0].id);
          }}
          placeholder="Search library"
          className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.05] pl-9 pr-9 text-sm text-white placeholder:text-white/35 outline-none transition-colors focus:border-[#ecc98c]/50 focus:bg-white/[0.08]"
        />
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-white/10 px-1.5 text-[10px] text-white/35 sm:block">
          /
        </kbd>
      </label>

      {isOpen && query.trim() && (
        <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-50 rounded-2xl border border-white/10 bg-[#11141c]/90 p-1.5 shadow-2xl shadow-black/60 backdrop-blur-2xl">
          {results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-white/45">Nothing in your library matches "{query.trim()}".</p>
          ) : (
            results.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => pick(g.id)}
                className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left outline-none hover:bg-white/[0.06] focus-visible:bg-white/[0.08]"
              >
                <Thumb game={g} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-white">{g.title}</span>
                  <span className="block text-xs text-white/45">{g.genre}</span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}