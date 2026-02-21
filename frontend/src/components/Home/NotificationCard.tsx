import { NotificationType } from "../../context/Notifications";
import { Link } from "react-router-dom";

interface Props {
  notification: NotificationType;
  onRead: (id: string) => void;
}

export default function NotificationCard({ notification, onRead }: Props) {
  const actor = notification.actorsPreview?.[0];

  // ✅ Safe description fallback
  const postDescription = notification.postId?.description ?? "";

  const postText =
    postDescription.length > 60
      ? postDescription.slice(0, 60) + "..."
      : postDescription;

  // ✅ Action mapping
  const actionText =
    notification.type === "LIKE"
      ? "liked your post"
      : notification.type === "COMMENT"
        ? "commented on your post"
        : "followed you";

  return (
    <div
      onClick={() => onRead(notification._id)}
      className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition
        ${notification.isRead
          ? "bg-[#191919] border-white/10"
          : "bg-[#222] border-sky-500/40"
        }
      `}
    >
      {/* Avatar */}
      <img
        src={actor?.avatar || "/default_avatar.png"}
        className="h-11 w-11 rounded-full object-cover"
      />

      {/* Content */}
      <div className="flex-1">
        {!notification.isRead && (
          <span className="h-2 w-2 rounded-full bg-red-500 mt-2"></span>
        )}
        {/* Main Text */}
        <p className="text-sm text-white leading-snug">
          <span className="font-semibold">{actor?.username}</span>{" "}
          {notification.count > 1 && (
            <span className="text-gray-400">
              and {notification.count - 1} others{" "}
            </span>
          )}
          {actionText}
        </p>

        {/* ✅ Post Preview Only If Exists */}
        {notification.postId && postDescription && (
          <Link
            to={`/?post=${notification.postId._id}`}
            className="block mt-1 text-gray-400 text-sm hover:text-white transition"
          >
            “{postText}”
          </Link>
        )}

        {/* Timestamp */}
        <p className="text-xs text-gray-500 mt-2">
          {new Date(notification.createdAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
