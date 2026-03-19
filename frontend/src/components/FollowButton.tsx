import { useState, useEffect } from "react";
import axios from "axios";
import { UserRoundPlus, UserRoundCheck, UserPlus, UserCheck } from "lucide-react";

interface FollowButtonProps {
  targetId: string;  // user to follow/unfollow
  initialFollowing: boolean;
}

const FollowButton: React.FC<FollowButtonProps> = ({targetId ,initialFollowing}) => {
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

  const toggleFollow = async () => {
    try {
      setLoading(true);
      if (isFollowing) {
        await axios.post(`${BACKEND_URL}/api/follow/${targetId}/unfollow`, {}, { withCredentials: true });
      } else {
        await axios.post(`${BACKEND_URL}/api/follow/${targetId}/follow`, {}, { withCredentials: true });
      }
      setIsFollowing(!isFollowing);
    }
    catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        console.error(err.response?.data?.error || err.message);
      } else if (err instanceof Error) {
        console.error(err.message);
      } else {
        console.error("An unknown error occurred");
      }
    }
    finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggleFollow}
      disabled={loading}
      /* - px-3 py-1.5: This creates the horizontal rectangle shape
         - w-fit: Ensures the button only takes up the space it needs
         - rounded-md: Keeps the corners slightly soft but structured
      */
      className="flex items-center justify-center px-3 py-1.5 w-fit rounded-md bg-[#1e1e1e]/20 hover:bg-black/40 border border-white/10 backdrop-blur-md transition-all disabled:opacity-50"
    >
      {isFollowing ? (
        /* Reduced size to 14px (w-3.5) for that tiny, precise look */
        <UserRoundCheck className="w-3.5 h-3 text-green-400" strokeWidth={2} />
      ) : (
        <UserRoundPlus className="w-3.5 h-3 text-white/80" strokeWidth={2} />
      )}
    </button>
  );
};

export default FollowButton;
