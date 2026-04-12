import { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

interface Chat {
  chatId: string;
  user: {
    id: string;
    name: string;
    avatar: string;
  };
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

const ChatsContext = createContext<{ chats: Chat[]; loading: boolean }>({
  chats: [],
  loading: true,
});

export const ChatsProvider = ({ children }: any) => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChats = async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/api/chat`, {
          withCredentials: true,
        });

        setChats(res.data);
      } catch (err) {
        console.error("Failed to fetch chats", err);
      } finally {
        setLoading(false);
      }
    };

    fetchChats();
  }, []);

  return (
    <ChatsContext.Provider value={{ chats, loading }}>
      {children}
    </ChatsContext.Provider>
  );
};

export const useChats = () => useContext(ChatsContext);