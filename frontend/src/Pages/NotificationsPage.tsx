import NotificationCard from "../components/Home/NotificationCard";
import { useNotification } from "../context/Notifications";
import { useEffect } from "react";

export default function NotificationsPage() {
  const BACKEND_URL =
    import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

  const {
    notifications,
    unreadCount,
    loading,
    markAsRead, 
    markAllAsRead,
  } = useNotification();
  useEffect(() => {
    if (!loading && unreadCount > 0) {
      markAllAsRead();
    }
  }, [loading, unreadCount]);

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold text-white">
          Notifications{" "}
          {unreadCount > 0 && (
            <span className="text-sky-500">({unreadCount})</span>
          )}
        </h1>
      </div>

      {/* Loading */}
      {loading && (
        <p className="text-gray-400 text-sm">Loading notifications...</p>
      )}

      {/* Empty */}
      {!loading && notifications.length === 0 && (
        <p className="text-gray-500 text-sm">
          No notifications yet.
        </p>
      )}

      {/* List */}
      <div className="space-y-3">
        {notifications.map((n) => (
          <NotificationCard
            key={n._id}
            notification={n}
            onRead={markAsRead}
          />
        ))}
      </div>
    </div>
  );
}
