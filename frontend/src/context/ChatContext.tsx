import { createContext, useContext, useState } from "react";

interface ChatContextType {
  openChatWith: (userId: string) => void;
  targetUserId: string | null;
}

const ChatContext = createContext<ChatContextType | null>(null);

export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
  const [targetUserId, setTargetUserId] = useState<string | null>(null);

  const openChatWith = (userId: string) => {
    setTargetUserId(userId);
  };

  return (
    <ChatContext.Provider value={{ openChatWith, targetUserId }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used inside ChatProvider");
  return ctx;
};