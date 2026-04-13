import { createContext, useContext, useState } from "react";

interface ChatTarget {
  id: string;
  name: string;
  avatar: string;
}

interface ChatContextType {
  openChatWith: (user: ChatTarget) => void;
  targetUser: ChatTarget | null;
}

const ChatContext = createContext<ChatContextType | null>(null);

export const ChatProvider = ({ children }: { children: React.ReactNode }) => {
  const [targetUser, setTargetUser] = useState<ChatTarget | null>(null);

  const openChatWith = (user: ChatTarget) => {
  setTargetUser(user);
};

  return (
    <ChatContext.Provider value={{ openChatWith, targetUser }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used inside ChatProvider");
  return ctx;
};