import { useState, useEffect, useCallback } from "react";

export function useTheme() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return true; // Default for SSR

    const stored = localStorage.getItem("theme");
    
    // 1. If user has explicitly saved a preference, use it
    if (stored) return stored === "dark";

    // 2. If no stored preference, check if they explicitly prefer light mode
    const prefersLight = window.matchMedia?.("(prefers-color-scheme: light)").matches;
    
    // 3. Otherwise, default to dark (true)
    return !prefersLight;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  const toggleTheme = useCallback(() => {
    setIsDark(prev => !prev);
  }, []);

  return { isDark, toggleTheme };
}