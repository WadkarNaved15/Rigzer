import { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

const SocketContext = createContext<Socket | null>(null);

export const SocketProvider = ({ userId, children }: any) => {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!userId) return;

    const newSocket = io(BACKEND_URL, {
      withCredentials: true,
      transports: ["websocket"],
    });
    newSocket.on("reconnect", () => {
      newSocket.emit("join", userId);
    });

    newSocket.on("connect", () => {
      console.log("Socket connected:", newSocket.id);
      newSocket.emit("join", userId);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [userId]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const socket = useContext(SocketContext);
  return socket;
};
