import { useState, useEffect } from "react";
import axios from "axios";
import FollowModal from "./FollowModal";
import { Users } from "lucide-react";
type FollowCountResponse = {
  count: number;
};
const FollowersList = ({ userId }: { userId: string }) => {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
  const [followers, setFollowers] = useState<FollowCountResponse>({ count: 0 });
  const [following, setFollowing] = useState<FollowCountResponse>({ count: 0 });
  const [loading, setLoading] = useState(true);
  const [modalType, setModalType] = useState<
    "followers" | "following" | null
  >(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchFollowData = async () => {
      try {
        setLoading(true);
        setError("");
        console.log("Fetching from:", `${BACKEND_URL}/api/follow/${userId}/followers`);

        const [followersRes, followingRes] = await Promise.all([
          axios.get(`${BACKEND_URL}/api/follow/${userId}/followers/count`),
          axios.get(`${BACKEND_URL}/api/follow/${userId}/following/count`)
        ]);

        setFollowers({ count: followersRes.data.count });
        setFollowing({ count: followingRes.data.count });
      } catch (err) {
        console.error("Error fetching follow data:", err);
        setError("Failed to load data.");
      } finally {
        setLoading(false);
      }
    };

    if (userId) fetchFollowData();
  }, [userId]);


  if (loading) {
    return (
      <div className="flex items-start space-x-4 text-gray-600 dark:text-gray-400">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  if (error) {
    return <p className="text-red-500 text-sm">{error}</p>;
  }

  return (
    <>
      <div className="flex items-center space-x-6 text-gray-700 dark:text-gray-300">

        {/* Followers */}
        <div
          className="text-center cursor-pointer hover:opacity-70 transition"
          onClick={() => setModalType("followers")}
        >
          <div className="text-xl font-bold">{followers?.count}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Followers</div>
        </div>

        {/* Following */}
        <div
          className="text-center cursor-pointer hover:opacity-70"
          onClick={() => setModalType("following")}
        >
          <div className="text-xl font-bold">{following?.count}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Following</div>
        </div>

      </div>
      {/* Modal */}
      {modalType && (
        <FollowModal
          userId={userId}
          type={modalType}
          onClose={() => setModalType(null)}
        />
      )}
    </>
  );
};

export default FollowersList;