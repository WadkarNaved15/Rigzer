import { useState, useEffect } from "react";
import axios from "axios";
import { UserPlus, UserCheck } from "lucide-react";

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
    } catch (err) {
      console.error(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggleFollow}
      disabled={loading}
      className="p-1 rounded-full transition-colors duration-150 hover:bg-gray-200 dark:hover:bg-gray-700"
    >
      {isFollowing ? (
        <UserCheck className="w-4 h-4 text-green-500" />
      ) : (
        <UserPlus className="w-4 h-4 text-blue-500" />
      )}
    </button>
  );
};

export default FollowButton;
