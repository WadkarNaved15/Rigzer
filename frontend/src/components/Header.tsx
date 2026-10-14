import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import ExternalLinkIcon from "./AdIcons/ExternalLinkIcon";
import {
  Moon,
  Search,
  Sun,
  Megaphone,
} from "lucide-react";
import { useTheme } from "../hooks/useTheme";
import Logo from "../assets/Icon.svg?react";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

// Define the type for a user object
interface User {
  _id: string;
  username: string;
  avatar: string;
  displayName: string;
  // You can add more properties here as needed
}

export function Header() {
  // Correctly type the state with the new User interface
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<User[]>([]);
  useTheme();
  const [isScrolled, setIsScrolled] = useState(false);
  const navigate = useNavigate();
  // const [searchQuery, setSearchQuery] = useState("");

  // Fetch suggestions as user types
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchQuery.trim() === "" || searchQuery.trim().length < 2) {
        setSuggestions([]);
        return;
      }
      try {
        const res = await fetch(`${BACKEND_URL}/api/search?q=${searchQuery}`);
        // Ensure the response data matches the User[] type
        const data: User[] = await res.json();
        setSuggestions(data);
      } catch (err) {
        console.error("Error fetching suggestions:", err);
      }
    };
    const debounceTimer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    if (!searchQuery.trim()) return;
    setSuggestions([]);
    navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
  };

  const handleAdsClick = () => {
    window.open("/ads", "_blank");
  };

  return (
    <header className={`sticky top-0 z-50 h-[50px] transition-all duration-300 border-b 
      border-gray-200 dark:border-white/10 
      ${isScrolled
        ? "bg-white/30 dark:bg-[#1e1e1e]/70 backdrop-blur-md shadow-sm"
        : "bg-white/15 dark:bg-[#1e1e1e]/40 backdrop-blur-sm"
      }`}
    >
      <div className=" mx-auto px-4 sm:px-6 lg:px-8 h-full">
        {/* Changed flex to grid with 3 columns */}
        <div className="grid grid-cols-3 items-center h-full">

          {/* Left spacer */}
          <div />

          {/* Center: Logo + Search */}
          <div className="flex items-center gap-3">

            {/* Logo */}
            <Link
              to="/"
              replace
              className="group relative flex items-center justify-center shrink-0"
              onClick={() =>
                window.scrollTo({ top: 0, behavior: "smooth" })
              }
            >
              <Logo
                className="h-8 w-8 transition-all duration-300 
                hover:-translate-y-[1px] text-[#469D84]"
              />
            </Link>

            {/* Search Bar */}
            <form
              onSubmit={handleSearch}
              className="relative hidden md:block w-[320px] lg:w-[400px]"
            >
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 
                  text-gray-400 h-4 w-4"
                />

                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="
                    w-full
                    pl-9
                    pr-4
                    py-2
                    text-sm
                    rounded-full
                    bg-gray-100
                    dark:bg-[#191716]
                    dark:text-white
                    border
                    border-gray-200
                    dark:border-white/10
                    outline-none
                    focus:ring-2
                    focus:ring-white/50
                  "
                />

                {/* Suggestions dropdown */}
                {suggestions.length > 0 && (
                  <ul
                    className="
                      absolute
                      z-50
                      mt-2
                      w-full
                      bg-white
                      dark:bg-gray-900
                      border
                      border-gray-200
                      dark:border-gray-700
                      rounded-lg
                      shadow-xl
                      max-h-60
                      overflow-y-auto
                    "
                  >
                    {suggestions.map((user: User) => (
                      <Link
                        key={user._id}
                        to={`/profile/${user.username}`}
                        onClick={() => setSuggestions([])}
                        className="
                          flex items-center gap-3
                          px-4 py-2
                          hover:bg-gray-100
                          dark:hover:bg-gray-800
                        "
                      >
                        <img
                          src={user.avatar || "/default_avatar.png"}
                          className="w-8 h-8 rounded-full object-cover"
                          alt=""
                        />

                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-medium truncate">
                            {user.displayName}
                          </span>

                          <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            @{user.username}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </ul>
                )}
              </div>
            </form>
          </div>

          {/* Right spacer */}
          <div />

        </div>
      </div>
    </header>
  );

}