import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Moon,
  Search,
  Sun,
  Home,
  UserRound,
  BriefcaseBusiness,
  LogOut,
  LogIn,
} from "lucide-react";
import { useTheme } from "../hooks/useTheme";
import { useUser } from "../context/user.js";
import { useSearch } from "../components/Home/SearchContext.js";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

// Define the type for a user object
interface User {
  _id: string;
  username: string;
  // You can add more properties here as needed
}

export function Header() {
  // Correctly type the state with the new User interface
  const { searchQuery,setSearchQuery, setSubmittedQuery, setShowFilteredFeed } = useSearch();
  const [suggestions, setSuggestions] = useState<User[]>([]);
  const { isDark, toggleTheme } = useTheme();
  const { user, logout } = useUser();
  const [scrollY, setScrollY] = useState(0); // This state isn't used, but it's not causing the error
  // const [searchQuery, setSearchQuery] = useState("");

  // Fetch suggestions as user types
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchQuery.trim() === "") {
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

  const handleLogout = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/Logout`, {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        logout();
        console.log("Logout successful");
        window.location.href = "/";
      }
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

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
    <header className="sticky top-0 z-50 bg-white dark:bg-[#1C1C1C] border-b border-gray-200 dark:border-gray-800 h-[50px]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-[50px]">
          {/* Left section */}
          <div className="flex items-center w-[50%]">
            <div
              className="flex-shrink-0"
              style={{
                transform: `translateX(calc(50vw - 68%))`,
                transition: "transform 0.3s ease-out",
              }}
            >
              <Link
                to="/"
                className="text-3xl dark:text-[#3D7A6E] tracking-wide"
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  letterSpacing: "0.05em",
                }}
                onClick={() =>
                  window.scrollTo({
                    top: 0,
                    behavior: "smooth",
                  })
                }
              >
                HESTER
              </Link>
            </div>

          </div>

          {/* Right section */}
          <div className="py-3 flex items-center space-x-4">
                        {/* Search Bar */}
            <form onSubmit={handleSearch} className="flex-1 max-w-2xl relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search"
                  className="w-full pl-10 pr-4 py-2 rounded-full bg-gray-100 dark:bg-gray-800 dark:text-white border-none focus:ring-2 focus:ring-purple-500"
                />

                {/* Suggestions dropdown */}
                {suggestions.length > 0 && (
                  <ul className="absolute z-10 mt-2 w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-60 overflow-y-auto transform transition-all duration-300 ease-in-out">
                    {suggestions.map((user: User) => (
                      <li
                        key={user._id}
                        className="group flex items-center px-4 py-3 cursor-pointer transition-colors duration-200 hover:bg-gray-200 dark:hover:bg-gray-800 focus:outline-none focus:bg-gray-200 dark:focus:bg-gray-800"
                        onClick={() => setSearchQuery(user.username)}
                      >
                        <div className="flex-shrink-0 mr-3">
                          <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-gray-500 dark:text-gray-400">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                        </div>
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 group-hover:text-black dark:group-hover:text-white">
                          {user.username}
                        </span>
                      </li>
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
            <button
              onClick={user ? handleLogout : () => (window.location.href = "/auth")}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label={user ? "Logout" : "Login"}
            >
              {user ? (
                <LogOut className="h-5 w-5 text-gray-600 dark:text-white" />
              ) : (
                <LogIn className="h-5 w-5 text-gray-600 dark:text-white" />
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}