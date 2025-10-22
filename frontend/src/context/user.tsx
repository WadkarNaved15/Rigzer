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
  token: string | null;
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
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const storedToken = localStorage.getItem("token");

    if (storedUser && storedToken) {
      try {
        setUser(JSON.parse(storedUser));
        setToken(storedToken);
      } catch (e) {
        console.error("Failed to parse user from localStorage", e);
      }
    }
    setLoading(false);
  }, []);

  // Verify session
  useEffect(() => {
    const verifySession = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/auth/verify", {
          method: "GET",
          credentials: "include",
        });

        if (res.ok) {
          const { user } = await res.json();
          login(user);
          console.log("✅ Session verified");
        }
      } catch (err) {
        console.warn("Session check failed:", err);
      }
    };

    verifySession();
  }, []);

  // Sync to localStorage
  useEffect(() => {
    if (user && token) {
      localStorage.setItem("user", JSON.stringify(user));
      localStorage.setItem("token", token);
    } else {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
    }
  }, [user, token]);

  const login = (userData: User) => {
    setUser(userData);
    // token is assumed to be handled via cookies, but can be updated here if needed
  };

  const logout = () => {
    setUser(null);
    setToken(null);
  };

  return (
    <UserContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </UserContext.Provider>
  );
};
