// src/context/UserContext.tsx
import React, {
  createContext, useContext, useState, useEffect, ReactNode,
} from "react";
import { saveAccount, removeAccount } from "../utils/accountRegistry";

type User = {
  _id: string;
  username: string;
  email: string;
  avatar?: string;
  banner?: string;
  bio?: string;
  role?: "user" | "admin";
  isPocketEligible?: boolean;
  socials?: {
    twitter?: string; instagram?: string;
    youtube?: string; discord?: string; steam?: string;
  };
  followersCount?: number;
  followingCount?: number;
};

type UserContextType = {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  login: (user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) throw new Error("useUser must be used within a UserProvider");
  return context;
};

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

  // Derived — never trust client-side state alone; the real gate is the backend.
  // This only controls what UI is rendered, not what data is accessible.
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/auth/verify`, {
          method: "GET", credentials: "include",
        });
        if (res.ok) {
          const { user } = await res.json();
          setUser(user);
          saveAccount({ userId: user._id, username: user.username, avatar: user.avatar });
        }
      } catch (err) {
        console.warn("Session check failed:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const refreshUser = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/verify`, { credentials: "include" });
      if (res.ok) { const { user } = await res.json(); setUser(user); }
    } catch (err) { console.error("Failed to refresh user", err); }
  };

  const login  = (userData: User) => setUser(userData);

  const logout = async () => {
    if (!user) return;
    try {
      await fetch(`${BACKEND_URL}/api/auth/logout`, { method: "POST", credentials: "include" });
    } catch (err) { console.warn("Logout request failed", err); }
    removeAccount(user._id);
    setUser(null);
    window.location.href = "/";
  };

  return (
    <UserContext.Provider value={{ user, loading, isAdmin, login, logout, refreshUser }}>
      {!loading && children}
    </UserContext.Provider>
  );
};