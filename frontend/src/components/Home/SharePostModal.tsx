import axios from "axios";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useSocket } from "../../context/SocketContext";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

interface SharePostModalProps {
  postId: string;
  onClose: () => void;
  currentUserId: string;
}

interface User {
  id: string;
  name: string;
  avatar: string;
}

export default function SharePostModal({ postId, onClose, currentUserId }: SharePostModalProps) {
  const [users, setUsers] = useState<User[]>([]);
  const socket = useSocket();
  if (!socket) return <div>Connecting...</div>;

  useEffect(() => {
    const fetchUsers = async () => {
      const res = await axios.get(`${BACKEND_URL}/api/users`, {
        withCredentials: true
      });

      const formatted = res.data.map((user: any) => ({
        id: user._id,
        name: user.username,
        avatar: user.username
          .split(" ")
          .map((w: string) => w[0])
          .join("")
          .toUpperCase()
      }));

      setUsers(formatted);
    };

    fetchUsers();
  }, []);

  const handleSend = async (receiverId: string) => {
    // start chat first
    const chatRes = await axios.post(
      `${BACKEND_URL}/api/chat/start`,
      { receiverId },
      { withCredentials: true }
    );

    const chatId = chatRes.data._id;

    // send post via socket
    socket.emit("send_post", {
      chatId,
      senderId: currentUserId,
      receiverId,
      postId
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-[#191919] w-[400px] rounded-xl shadow-xl p-4">

        {/* Header */}
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold">Share Post</h2>
          <button onClick={onClose}>
            <X />
          </button>
        </div>

        {/* User List */}
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {users.map(user => (
            <div
              key={user.id}
              onClick={() => handleSend(user.id)}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center font-bold">
                {user.avatar}
              </div>
              <span className="font-medium">{user.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
