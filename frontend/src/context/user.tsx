// src/context/UserContext.tsx
import React, {
  createContext, useContext, useState, useEffect, ReactNode,
} from "react";
import { saveAccount, removeAccount } from "../utils/accountRegistry";
import api from "../utils/api";

type User = {
  _id: string;
  username: string;
  displayName?: string;
  location?: string;
  website?: string;
  birthdate?: string;
  jobTitle?: string;
  email: string;
  avatar?: string;
  banner?: string;
  bio?: string;
  role?: "user" | "admin";
  isRigzer?: boolean;
  isPocketEligible?: boolean;
  isGoogleUser?: boolean;
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
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

  // Derived — never trust client-side state alone; the real gate is the backend.
  // This only controls what UI is rendered, not what data is accessible.
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await api.get("/api/auth/verify");

        if (!cancelled) {
          const user = res.data.user as User;
          setUser(user);

          saveAccount({
            userId: user._id,
            username: user.username,
            avatar: user.avatar,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setUser(null);
          console.warn("Session check failed:", err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);


  useEffect(() => {
    const handleSessionExpired = () => {
      setUser((currentUser) => {
        if (currentUser) {
          removeAccount(currentUser._id);
        }

        return null;
      });
    };

    window.addEventListener("rigzer:session-expired", handleSessionExpired);

    return () => {
      window.removeEventListener(
        "rigzer:session-expired",
        handleSessionExpired
      );
    };
  }, []);


  const refreshUser = async () => {
    try {
      const res = await api.get("/api/auth/verify");
      const user = res.data.user as User;

      setUser(user);

      saveAccount({
        userId: user._id,
        username: user.username,
        avatar: user.avatar,
      });
    } catch (err) {
      console.error("Failed to refresh user", err);
      throw err;
    }
  };

  const login = (userData: User) => setUser(userData);

  const logout = async () => {
    try {
      await api.post("/api/auth/logout");
    } catch (err) {
      console.warn("Logout request failed", err);
    } finally {
      if (user) {
        removeAccount(user._id);
      }

      setUser(null);
      window.location.href = "/";
    }
  };

  return (
    <UserContext.Provider value={{ user, loading, isAdmin, login, logout, refreshUser }}>
      {!loading && children}
    </UserContext.Provider>
  );
};