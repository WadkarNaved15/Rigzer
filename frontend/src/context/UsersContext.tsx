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
  setUsers: React.Dispatch<React.SetStateAction<User[]>>; // ✅ add this
  loading: boolean;
}

const UsersContext = createContext<UsersContextValue>({
  users: [],
  setUsers: () => {},
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
    const res = await axios.get(`${BACKEND_URL}/api/chat/my-chats`, {
      withCredentials: true
    });

    const formatted = res.data.map((chat: any) => ({
      id: chat.user.id,
      name: chat.user.name,
      avatar: chat.user.avatar,
      unreadCount: 0,
      status: "online",
      lastSeen: "Unknown",
      chatId: chat.chatId // 🔥 IMPORTANT
    }));

    setUsers(formatted);

  } catch (err) {
    console.error("Fetch chats failed", err);
  } finally {
    setLoading(false);
  }
};

    fetchUsers();
  }, [user]);

  return (
    <UsersContext.Provider value={{ users, setUsers, loading }}>
      {children}
    </UsersContext.Provider>
  );
}

export const useUsers = () => useContext(UsersContext);
