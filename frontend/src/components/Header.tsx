import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { useTheme } from "../hooks/useTheme";
import { LauncherSearch } from "./OTT/LauncherSearch";
import { LauncherActions } from "./OTT/LauncherActions";
import { LIBRARY_GAMES } from "./OTT/gameData";

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

interface User {
  _id: string;
  username: string;
  avatar: string;
  displayName: string;
}

interface HeaderProps {
  isToggled: boolean;
  onToggle: () => void;
  onOpenFeedback: () => void;
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
}

export function Header({
  isToggled,
  onToggle,
  onOpenFeedback,
  onOpenPrivacy,
  onOpenTerms,
}: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<User[]>([]);
  const [isScrolled, setIsScrolled] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);

  // three-dot menu
  const [menuOpen, setMenuOpen] = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useTheme();
  const navigate = useNavigate();

  // Synchronize current game ID with hash-based routing
  useEffect(() => {
    const updateGameFromHash = () => {
      const hash = window.location.hash;
      const match = hash.match(/\/game\/([a-zA-Z0-9_-]+)/);
      if (match) {
        setCurrentId(match[1]);
      } else {
        setCurrentId(null);
      }
    };

    updateGameFromHash();
    window.addEventListener("hashchange", updateGameFromHash);
    return () => window.removeEventListener("hashchange", updateGameFromHash);
  }, []);

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `${BACKEND_URL}/api/search?q=${encodeURIComponent(searchQuery.trim())}`,
          { signal: controller.signal }
        );

        if (!res.ok) {
          throw new Error(`Search failed: ${res.status}`);
        }

        const data: User[] = await res.json();
        setSuggestions(data);
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          console.error("Error fetching suggestions:", err);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close the three-dot menu on outside click / Escape; focus first item on open
  useEffect(() => {
    if (!menuOpen) return;

    menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();

    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        !menuRef.current?.contains(target) &&
        !moreRef.current?.contains(target)
      ) {
        setMenuOpen(false);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        moreRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    if (!searchQuery.trim()) return;

    setSuggestions([]);
    navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  // Spotify-style menu item: no arrows, soft hover
  const menuItemClass =
    "block w-full rounded-[4px] px-3 py-2.5 text-left text-[0.875rem] font-medium text-[#e8e8e8] transition-colors hover:bg-white/10 focus-visible:bg-white/10 focus-visible:outline-none";

  const menuItems: { label: string; onSelect: () => void }[] = [
    { label: "Feedback", onSelect: onOpenFeedback },
    { label: "Privacy Policy", onSelect: onOpenPrivacy },
    { label: "Terms of Service", onSelect: onOpenTerms },
  ];

  return (
    <header
      className={`sticky top-0 z-50 h-[58px] border-b transition-all duration-300 ${
        isToggled
          ? "border-white/[0.07] bg-[#0b0d13]/95 text-white backdrop-blur-xl"
          : `border-gray-200 dark:border-white/10 ${
              isScrolled
                ? "bg-white/30 shadow-sm backdrop-blur-md dark:bg-[#1e1e1e]/70"
                : "bg-white/15 backdrop-blur-sm dark:bg-[#1e1e1e]/40"
            }`
      }`}
    >
      {/* Three hand-drawn dots: opens the menu */}
      <button
        ref={moreRef}
        type="button"
        aria-label="More options"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls="header-more-menu"
        onClick={() => setMenuOpen((open) => !open)}
        className={`absolute left-10 2xl:left-20 top-1/2 hidden h-7 w-8 -translate-y-1/2 place-items-center rounded-lg p-0 transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3fb89a] lg:grid ${
          menuOpen ? "bg-white/10" : ""
        } ${isToggled ? "text-white" : "text-gray-800 dark:text-white"}`}
      >
        <svg
          viewBox="0 0 26 10"
          aria-hidden="true"
          className="block h-[10px] w-[26px] fill-current"
        >
          <path d="M2.2 1.6C3.8.6 6.2.9 6.9 2.9c.6 1.9-.4 4.3-2.6 4.6-1.9.3-3.4-.5-3.5-2.3l-.2-1.2c.4.1 1-.8 1.6-2.4z" />
          <path d="M11.6 1.3c1.8-1 4.2-.3 4.6 1.8.4 2.2-1 4.4-3.2 4.5-2.2.1-3.7-1.5-3.4-3.5.1-1.2.9-2.2 2-2.8z" />
          <path d="M20 1.7c2-1 4.6-.4 5.2 1.8.5 2-.9 4.1-3.1 4.3-2.4.2-4.2-1.4-3.7-3.6.2-1 .8-2 1.6-2.5z" />
        </svg>
      </button>

      {menuOpen && (
        <div
          ref={menuRef}
          id="header-more-menu"
          role="menu"
          className="absolute left-10 2xl:left-20 top-[calc(100%+4px)] z-30 hidden min-w-[200px] rounded-lg bg-[#1c1c1c] p-1 shadow-[0_16px_24px_rgba(0,0,0,0.3),0_6px_8px_rgba(0,0,0,0.2)] lg:block"
        >
          {menuItems.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={menuItemClass}
              onClick={() => {
                setMenuOpen(false);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}

          {/* Narrower fading separator line made darker */}
          <div className="mx-2 my-1.5 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent" />

          {/* Smaller copyright text mark */}
          <div className="px-3 py-1 text-[0.65rem] text-gray-500">
            © {new Date().getFullYear()} Rigzer
          </div>
        </div>
      )}

      {/* Centered logo + search in BOTH modes */}
      <div className="absolute left-1/2 top-0 flex h-full w-[min(440px,calc(100%-32px))] -translate-x-1/2 items-center gap-3">
        <Link
          to="/"
          replace
          aria-label="Rigzer home"
          className="flex shrink-0 items-center justify-center"
          onClick={() =>
            window.scrollTo({ top: 0, behavior: "smooth" })
          }
        >
          <img
            src="/Logo.png"
            alt="Rigzer"
            className="h-9 w-9 object-contain transition-transform duration-200 hover:scale-105"
          />
        </Link>

        {isToggled ? (
          <div className="min-w-0 flex-1">
            <LauncherSearch
              games={LIBRARY_GAMES}
              onOpen={(id) => {
                window.location.hash = `/game/${id}`;
              }}
            />
          </div>
        ) : (
          <form
            onSubmit={handleSearch}
            className="relative min-w-0 flex-1"
          >
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="w-full rounded-xl bg-gray-100 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#469D84]/30 dark:bg-[#191716] dark:text-white"
            />

            {suggestions.length > 0 && (
              <ul className="absolute left-0 top-full z-50 mt-2 max-h-60 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
                {suggestions.map((user) => (
                  <li key={user._id}>
                    <Link
                      to={`/profile/${user.username}`}
                      onClick={() => setSuggestions([])}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      <img
                        src={user.avatar || "/default_avatar.png"}
                        alt=""
                        className="h-8 w-8 rounded-full object-cover"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {user.displayName}
                        </p>
                        <p className="truncate text-xs text-gray-500">
                          @{user.username}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </form>
        )}
      </div>

      {/* Launcher actions rendered independently on the far right */}
      {isToggled && (
        <LauncherActions
          games={LIBRARY_GAMES}
          currentId={currentId}
          onOpen={(id) => {
            window.location.hash = `/game/${id}`;
          }}
          onToggle={onToggle}
          onSettings={() => navigate("/settings")}
          onProfile={() => navigate("/profile")}
          onFriends={() => navigate("/friends")}
          onSignOut={() => navigate("/signin")}
        />
      )}
    </header>
  );
}