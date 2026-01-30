import { useState, useEffect } from "react";
import axios from "axios";
import { UserRoundPlus, UserRoundCheck, UserPlus, UserCheck } from "lucide-react";

interface FollowButtonProps {
  userId: string;    // current logged-in user
  targetId: string;  // user to follow/unfollow
}

const FollowButton: React.FC<FollowButtonProps> = ({ userId, targetId }) => {
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(false);
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

  useEffect(() => {
    const checkFollowing = async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/api/follow/${userId}/following`, {
          withCredentials: true,
        });
        setIsFollowing(res.data.following.includes(targetId));
      } catch (err) {
        console.error("Error checking follow status:", err);
      }
    };

    if (userId && targetId) checkFollowing();
  }, [userId, targetId]);

  const toggleFollow = async () => {
    try {
      console.log("Toggling follow for user:", userId, "and target:", targetId);
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
      className="flex items-center justify-center p-1 rounded-md bg-[#1e1e1e]/30 hover:bg-black/40 border border-white/10 backdrop-blur-sm transition-all disabled:opacity-50"
    >
      {isFollowing ? (
        <UserRoundCheck className="w-4 h-4 text-green-400" strokeWidth={2} />
      ) : (
        <UserRoundPlus className="w-4 h-4 text-white/90" strokeWidth={2} />
      )}
    </button>
  );
};

export default FollowButton;
