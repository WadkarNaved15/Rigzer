import axios from "axios";
import { X, Search } from "lucide-react";
import { useSocket } from "../../context/SocketContext";
import { useUsers } from "../../context/UsersContext";
import { toast } from "react-toastify";
import { useState } from "react";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
const DEFAULT_AVATAR = "https://images.unsplash.com/photo-1494790108377-be9c29b29330";

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
  const [search, setSearch] = useState("");

  // Filter users based on search input
  const filteredUsers = users?.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSend = async (receiverId: string) => {
    if (!socket) return;

    try {
      const chatRes = await axios.post(
        `${BACKEND_URL}/api/chat/start`,
        { receiverId },
        { withCredentials: true }
      );

      const chatId = chatRes.data._id;
      socket.emit("join_chat", chatId);
      socket.emit("send_post", {
        chatId,
        senderId: currentUserId,
        receiverId,
        postId,
      });

      toast.success("Sent", {
        position: "bottom-center",
        autoClose: 1500,
        hideProgressBar: true,
        theme: "dark"
      });
      
      onClose();
    } catch (error) {
      console.error("Error sharing post:", error);
      toast.error("Failed to share");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white dark:bg-[#191919] w-full max-w-[450px] rounded-2xl shadow-2xl overflow-hidden border border-gray-100 dark:border-zinc-800">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-zinc-800">
          <div className="flex items-center gap-4">
            <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition">
              <X size={20} className="text-gray-600 dark:text-zinc-400" />
            </button>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Share Post</h2>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-3">
          <div className="relative flex items-center group">
            <Search className="absolute left-3 text-gray-400 group-focus-within:text-blue-500 transition-colors" size={18} />
            <input 
              type="text"
              placeholder="Search people"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-transparent border border-gray-200 dark:border-zinc-700 rounded-full text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:text-white transition-all"
            />
          </div>
        </div>

        {/* User List */}
        <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center py-10 gap-2">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs text-gray-500">Loading friends...</p>
            </div>
          ) : (
            <div className="pb-2">
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  onClick={() => handleSend(user.id)}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <img 
                      src={DEFAULT_AVATAR} 
                      alt={user.name}
                      className="h-10 w-10 rounded-full object-cover border border-gray-100 dark:border-zinc-800"
                    />
                    <div className="flex flex-col">
                      <span className="font-bold text-[15px] text-gray-900 dark:text-white leading-tight">
                        {user.name}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-zinc-500">
                        @{user.name.toLowerCase().replace(/\s/g, '')}
                      </span>
                    </div>
                  </div>
                  
                  <button className="bg-gray-900 dark:bg-white text-white dark:text-black px-4 py-1.5 rounded-full text-sm font-bold hover:opacity-90 transition">
                    Send
                  </button>
                </div>
              ))}
              {filteredUsers.length === 0 && (
                <div className="text-center py-10 text-gray-500 dark:text-zinc-500">
                  No users found
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}