import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import axios from "axios";
import { useUser } from "./user";
import { useSocket } from "./SocketContext";
export interface NotificationType {
  _id: string;
  type: "LIKE" | "COMMENT" | "FOLLOW";
  count: number;
  isRead: boolean;
  createdAt: string;

  actorsPreview: {
    _id: string;
    username: string;
    avatar?: string;
  }[];

  postId?: {
    _id: string;
    description?: string;
    assets?: any[];
  };
}

interface NotificationContextType {
  notifications: NotificationType[];
  unreadCount: number;
  loading: boolean;

  fetchNotifications: () => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
}

const NotificationContext = createContext<
  NotificationContextType | undefined
>(undefined);

export const useNotification = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx)
    throw new Error(
      "useNotification must be used inside NotificationProvider"
    );
  return ctx;
};

export const NotificationProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const { user } = useUser();

  const BACKEND_URL =
    import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;

    socket.on("new-notification", (notification) => {
      setNotifications((prev) => {
        const exists = prev.some((n) => n._id === notification._id);

        if (!exists) {
          setUnreadCount((c) => c + 1);
          return [notification, ...prev];
        }

        // If exists → replace updated version (count increased)
        return prev.map((n) =>
          n._id === notification._id ? notification : n
        );
      });
    });

    return () => {
      socket.off("new-notification");
    };
  }, [socket]);

  useEffect(() => {
    if (!socket || !user?._id) return;
    socket.emit("join", user._id);
  }, [socket, user?._id]);


  // ✅ Fetch Notifications
  const fetchNotifications = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      const res = await axios.get(`${BACKEND_URL}/api/notifications`, {
        withCredentials: true,
      });

      setNotifications(res.data);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    } finally {
      setLoading(false);
    }
  }, [BACKEND_URL, user?._id]);

  // ✅ Fetch Unread Count
  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;

    try {
      const res = await axios.get(
        `${BACKEND_URL}/api/notifications/unread-count`,
        { withCredentials: true }
      );

      setUnreadCount(res.data.unread);
    } catch (err) {
      console.error("Failed to fetch unread count:", err);
    }
  }, [BACKEND_URL, user?._id]);

  // ✅ Mark One Read
  const markAsRead = async (id: string) => {
    try {
      await axios.patch(
        `${BACKEND_URL}/api/notifications/${id}/read`,
        {},
        { withCredentials: true }
      );

      // Optimistic Update
      setNotifications((prev) =>
        prev.map((n) =>
          n._id === id ? { ...n, isRead: true } : n
        )
      );

      fetchUnreadCount();
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  };

  // ✅ Mark All Read
  const markAllAsRead = async () => {
    try {
      await axios.patch(
        `${BACKEND_URL}/api/notifications/read-all`,
        {},
        { withCredentials: true }
      );

      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true }))
      );

      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  // ✅ Auto Refresh When User Switches
  useEffect(() => {
    if (!user) return;

    // Reset instantly (Instagram UX)
    setNotifications([]);
    setUnreadCount(0);

    fetchNotifications();
    fetchUnreadCount();
  }, [user?._id]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
