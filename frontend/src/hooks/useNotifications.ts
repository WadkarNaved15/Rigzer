import { useEffect, useState, useCallback } from "react";
import axios from "axios";

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

export const useNotifications = (BACKEND_URL: string) => {
  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // ✅ Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);

      const res = await axios.get(`${BACKEND_URL}/api/notifications`, {
        withCredentials: true,
      });
      console.log("Notifications:", res.data);
      setNotifications(res.data);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    } finally {
      setLoading(false);
    }
  }, [BACKEND_URL]);

  // ✅ Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await axios.get(
        `${BACKEND_URL}/api/notifications/unread-count`,
        { withCredentials: true }
      );

      setUnreadCount(res.data.unread);
    } catch (err) {
      console.error("Failed to fetch unread count:", err);
    }
  }, [BACKEND_URL]);

  // ✅ Mark one as read
  const markAsRead = async (id: string) => {
    try {
      await axios.patch(
        `${BACKEND_URL}/api/notifications/${id}/read`,
        {},
        { withCredentials: true }
      );

      // Optimistic UI update
      setNotifications((prev) =>
        prev.map((n) =>
          n._id === id ? { ...n, isRead: true } : n
        )
      );

      fetchUnreadCount();
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  // ✅ Mark all as read
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

  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
  }, [fetchNotifications, fetchUnreadCount]);

  return {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  };
};
