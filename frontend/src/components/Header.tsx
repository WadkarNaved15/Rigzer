import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Moon,
  Search,
  Sun,
} from "lucide-react";
import { useTheme } from "../hooks/useTheme";
import { useSearch } from "../components/Home/SearchContext.js";
import Logo from "../assets/Rigzer.svg?react";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

// Define the type for a user object
interface User {
  _id: string;
  username: string;
  avatar: string;
  // You can add more properties here as needed
}

export function Header() {
  // Correctly type the state with the new User interface
  const { searchQuery, setSearchQuery, setSubmittedQuery, setShowFilteredFeed } = useSearch();
  const [suggestions, setSuggestions] = useState<User[]>([]);
  const { isDark, toggleTheme } = useTheme();
  const [isScrolled, setIsScrolled] = useState(false);
  // const [searchQuery, setSearchQuery] = useState("");

  // Fetch suggestions as user types
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchQuery.trim() === "" && searchQuery.trim().length < 2) {
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

  // const handleSearch = (e: React.FormEvent) => {
  //   e.preventDefault();
  //   if (searchQuery.trim() === "") return;
  //   console.log("Searching for:", searchQuery);
  //   // window.location.href = `/search?q=${encodeURIComponent(searchQuery)}`;
  // };
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim() !== "") {
      setSubmittedQuery(searchQuery); // 🔹 save submitted query
      setShowFilteredFeed(true);   // ✅ switch to filtered feed
    }
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

          {/* 1. Left Section - Empty or placeholder to balance the grid */}
          <div className="flex items-center">
            {/* You can put a menu icon here later if needed */}
          </div>

          {/* 2. Center Section - Logo */}
          <div className="flex justify-center items-center">
            {/* <Link
              to="/"
              className="text-3xl dark:text-[#3D7A6E] tracking-wide"
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                letterSpacing: "0.05em",
              }}
              onClick={() =>
                window.scrollTo({ top: 0, behavior: "smooth" })
              }
            >
              RIGZER
            </Link> */}
            {/* <Link
              to="/"
              className="flex items-center justify-center"
              onClick={() =>
                window.scrollTo({ top: 0, behavior: "smooth" })
              }
            >
              <img
                src={logo}
                alt="Rigzer Logo"
                className="h-12 w-auto object-contain"
              />
            </Link> */}
            <Link
              to="/"
              replace
              className="group relative flex items-center justify-center"
            >
              <Logo
                className="h-12 w-auto transition-all duration-300 hover:-translate-y-[1px] text-gray-800 dark:text-[#29665a]" />
            </Link>
          </div>

          {/* 3. Right Section - Search & Theme */}
          <div className="flex items-center justify-end space-x-4">
            {/* Search Bar */}
            <form onSubmit={handleSearch} className="relative hidden md:block w-full max-w-[250px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search"
                  className="w-full pl-9 pr-4 py-1.5 text-sm rounded-full bg-gray-100 dark:bg-[#191716] dark:text-white border-none focus:ring-2 focus:ring-purple-500"
                />

                {/* Suggestions dropdown (restored logic) */}
                {suggestions.length > 0 && (
                  <ul className="absolute z-10 mt-2 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    {suggestions.map((user: User) => (
                      <Link
                        key={user._id}
                        to={`/profile/${user.username}`}
                        onClick={() => setSuggestions([])}
                        className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        <img
                          src={user.avatar || "/default_avatar.png"}
                          className="w-8 h-8 rounded-full object-cover"
                        />

                        <div className="flex flex-col text-sm">
                          <span className="font-medium flex items-center gap-1">
                            {user.username}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </ul>
                )}
              </div>
            </form>

            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Toggle Theme"
            >
              {isDark ? (
                <Sun className="h-5 w-5 text-gray-600 dark:text-white" />
              ) : (
                <Moon className="h-5 w-5 text-gray-600 dark:text-white" />
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );

}