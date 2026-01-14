import axios from "axios";
import { X } from "lucide-react";
import { useSocket } from "../../context/SocketContext";
import { useUsers } from "../../context/UsersContext";
import { toast } from "react-toastify"; // Import added

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

interface SharePostModalProps {
  postId: string;
  onClose: () => void;
  currentUserId: string;
}

export default function SharePostModal({
  postId,
  onClose,
  currentUserId,
}: SharePostModalProps) {
  const socket = useSocket();
  const { users, loading } = useUsers();

  const handleSend = async (receiverId: string) => {
    if (!socket) return;

    try {
      const chatRes = await axios.post(
        `${BACKEND_URL}/api/chat/start`,
        { receiverId },
        { withCredentials: true }
      );

      const chatId = chatRes.data._id;

      // join chat room
      socket.emit("join_chat", chatId);

      socket.emit("send_post", {
        chatId,
        senderId: currentUserId,
        receiverId,
        postId,
      });

      // Success Toast
      toast.success("Post shared successfully!", {
        autoClose: 2000,
        pauseOnHover: false,
      });
      
      onClose();
    } catch (error) {
      console.error("Error sharing post:", error);
      toast.error("Failed to share post. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-[#191919] w-[400px] rounded-xl shadow-xl p-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold text-black dark:text-white">Share Post</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-black dark:hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* User List */}
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {loading && <div className="text-center py-4">Loading...</div>}

          {!loading &&
            users.map((user) => (
              <div
                key={user.id}
                onClick={() => handleSend(user.id)}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <div className="h-10 w-10 rounded-full bg-gray-300 dark:bg-zinc-700 flex items-center justify-center font-bold">
                  {user.avatar}
                </div>
                <span className="font-medium text-black dark:text-white">{user.name}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}