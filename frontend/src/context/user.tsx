import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

// Type definitions (optional — safe for JS if removed)
type User = {
  id: string;
  name: string;
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
          console.log("✅ Session verified");
        }
      } catch (err) {
        console.warn("Session check failed:", err);
      } finally {
        setLoading(false);   // ✅ VERY IMPORTANT
      }
    };

    verifySession();
  }, []);

  const login = (userData: User) => {
    setUser(userData);
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <UserContext.Provider value={{ user, loading, login, logout }}>
      {!loading && children}
    </UserContext.Provider>
  );
};

