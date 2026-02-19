// context/UsersContext.tsx
import { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";
import { useUser } from "./user";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

export interface User {
  id: string;
  name: string;
  avatar: string;
  status?: string;
  unreadCount: number;
  lastSeen?: string;
}

interface UsersContextValue {
  users: User[];
  loading: boolean;
}

const UsersContext = createContext<UsersContextValue>({
  users: [],
  loading: true
});

export function UsersProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setUsers([]);
      setLoading(false);
      return;
    }

    const fetchUsers = async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/api/users`, {
          withCredentials: true
        });

        const formatted = res.data.filter((u:any) => u._id !== user._id).map((u: any) => ({
          id: u._id,
          name: u.username,
          avatar: u.username
            .split(" ")
            .map((w: string) => w[0])
            .join("")
            .toUpperCase(),
          status: "online",
          lastSeen: "Unknown",
          unreadCount: 0
        }));

        setUsers(formatted);
      } catch (err) {
        console.error("Fetch users failed", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [user]);

  return (
    <UsersContext.Provider value={{ users, loading }}>
      {children}
    </UsersContext.Provider>
  );
}

export const useUsers = () => useContext(UsersContext);
