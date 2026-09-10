// context/UsersContext.tsx
import { createContext, useContext, useEffect, useState } from "react";
import { useSocket } from "./SocketContext";
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

  // chat information
  chatId?: string;
  chatStatus?: "pending" | "accepted" | "declined";
  requestedBy?: string;
}

interface UsersContextValue {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>; // ✅ add this
  loading: boolean;
}

const UsersContext = createContext<UsersContextValue>({
  users: [],
  setUsers: () => { },
  loading: true
});

export function UsersProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const socket = useSocket();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setUsers([]);
      setLoading(false);
      return;
    }

    if (user) {
      localStorage.removeItem("rigzer_guest_started");
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
          chatId: chat.chatId,
          chatStatus: chat.status,
          requestedBy: chat.requestedBy,
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

  useEffect(() => {
    if (!socket || !user?._id) return;

    const handleNewChatRequest = (data: any) => {
      if (!data?.chatId || !data?.user?.id) return;

      setUsers((prev) => {
        const existingIndex = prev.findIndex(
          (u) => u.id === data.user.id
        );

        if (existingIndex !== -1) {
          return prev.map((u, index) =>
            index === existingIndex
              ? {
                ...u,
                chatId: data.chatId,
                chatStatus: data.status,
                requestedBy: data.requestedBy,
                name: data.user.name,
                avatar: data.user.avatar,
              }
              : u
          );
        }

        return [
          {
            id: data.user.id,
            name: data.user.name,
            avatar: data.user.avatar || "",
            unreadCount: 0,
            status: "online",
            lastSeen: "Just now",
            chatId: data.chatId,
            chatStatus: data.status,
            requestedBy: data.requestedBy,
          },
          ...prev,
        ];
      });
    };

    socket.on("new-chat-request", handleNewChatRequest);

    return () => {
      socket.off("new-chat-request", handleNewChatRequest);
    };
  }, [socket, user?._id]);

  return (
    <UsersContext.Provider value={{ users, setUsers, loading }}>
      {children}
    </UsersContext.Provider>
  );
}

export const useUsers = () => useContext(UsersContext);
