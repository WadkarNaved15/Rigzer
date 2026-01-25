import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { saveAccount } from "../utils/accountRegistry";
import { removeAccount } from "../utils/accountRegistry";

// Type definitions (optional — safe for JS if removed)
type User = {
  _id: string;
  username: string;
  email: string;
  avatar?: string;
  followersCount?: number;
  followingCount?: number;
};

type UserContextType = {
  user: User | null;
  loading: boolean;
  login: (user: User) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

// Create context
const UserContext = createContext<UserContextType | undefined>(undefined);

// Hook for accessing context
export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) throw new Error("useUser must be used within a UserProvider");
  return context;
};

// Provider component
export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

  useEffect(() => {
  const verifySession = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/verify`, {
        method: "GET",
        credentials: "include",
      });

      if (res.ok) {
        const { user } = await res.json();
        setUser(user);
        console.log("user verified:", user);
        // ✅ store account for switcher
        saveAccount({
          userId: user._id,
          username: user.username,
          avatar: user.avatar,
        });

        console.log("✅ Session verified & account stored");
      }
    } catch (err) {
      console.warn("Session check failed:", err);
    } finally {
      setLoading(false);
    }
  };

  verifySession();
}, []);
const refreshUser = async () => {
  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/verify`, {
      credentials: "include"
    });

    if (res.ok) {
      const { user } = await res.json();
      setUser(user);
    }
  } catch (err) {
    console.error("Failed to refresh user", err);
  }
};

  const login = (userData: User) => {
    setUser(userData);
  };

  const logout = async () => {
  if (!user) return;

  try {
    await fetch(`${BACKEND_URL}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    window.location.href = "/"; 
  } catch (err) {
    console.warn("Logout request failed", err);
  }

  // 🔥 remove only this account from device storage
  removeAccount(user._id);

  // clear app state
  setUser(null);
};


  return (
    <UserContext.Provider value={{ user, loading, login, logout,refreshUser}}>
      {!loading && children}
    </UserContext.Provider>
  );
};

