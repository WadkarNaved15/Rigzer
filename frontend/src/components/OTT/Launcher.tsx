import { useCallback, useEffect, useMemo, useState } from "react";
import GameDetail from "./gameDetail";
import GameLibrary from "./GameLibrary";
import { LIBRARY_GAMES } from "./gameData";
const WISHLIST_KEY = "launcher:wishlist";

/** #/game/<id>  ->  <id>, anything else -> null (library view) */
function readHash(): string | null {
  if (typeof window === "undefined") return null;
  const m = window.location.hash.match(/^#\/game\/([\w-]+)/);
  return m ? m[1] : null;
}

function loadWishlist(): Set<string> {
  try {
    const raw = window.localStorage.getItem(WISHLIST_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export default function Launcher() {
  const [gameId, setGameId] = useState<string | null>(readHash);
  const [wishlist, setWishlist] = useState<Set<string>>(loadWishlist);

  // The URL is the source of truth, so the browser back button works.
  useEffect(() => {
    const sync = () => {
      setGameId(readHash());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const open = useCallback((id: string) => {
    window.location.hash = `/game/${id}`;
  }, []);

  const toLibrary = useCallback(() => {
    window.location.hash = "/";
  }, []);

  const toggleWishlist = useCallback((id: string) => {
    setWishlist((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        window.localStorage.setItem(WISHLIST_KEY, JSON.stringify([...next]));
      } catch {
        /* storage unavailable (private mode), keep the in-memory state */
      }
      return next;
    });
  }, []);

  const game = LIBRARY_GAMES.find((g) => g.id === gameId) ?? null;
  const totalHours = useMemo(() => LIBRARY_GAMES.reduce((sum, g) => sum + g.hoursPlayed, 0), []);

  return (
    <div className="min-h-screen bg-[#0b0d13] text-white antialiased selection:bg-[#ecc98c]/30">
      {game ? (
        // key resets per-game UI state (play button, tabs, modals) when switching
        <GameDetail
          key={game.id}
          game={game}
          wishlisted={wishlist.has(game.id)}
          onToggleWishlist={() => toggleWishlist(game.id)}
          onBack={toLibrary}
        />
      ) : (
        <main className="mx-auto max-w-[1280px] px-5 pb-16 sm:px-8">
          <div className="mb-2 flex items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-[#f6efe2]">Library</h1>
              <p className="mt-1 text-sm text-white/45">
                {LIBRARY_GAMES.length} games · {totalHours} hours played
              </p>
            </div>
          </div>
          <GameLibrary games={LIBRARY_GAMES} onSelect={(g) => open(g.id)} />
        </main>
      )}
    </div>
  );
}