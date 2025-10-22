import { useState, useEffect } from "react";
import axios from "axios";
import { Users } from "lucide-react";

const FollowersList = ({ userId }) => {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
  const [followers, setFollowers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

useEffect(() => {
  const fetchFollowData = async () => {
    try {
      setLoading(true);
      setError("");
      console.log("Fetching from:", `${BACKEND_URL}/api/follow/${userId}/followers`);

      const [followersRes, followingRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/follow/${userId}/followers`),
        axios.get(`${BACKEND_URL}/api/follow/${userId}/following`)
      ]);

      console.log("Followers:", followersRes.data);
      console.log("Following:", followingRes.data);

      setFollowers(followersRes.data || []);
      setFollowing(followingRes.data || []);
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
    <div className="flex items-center space-x-6 text-gray-700 dark:text-gray-300">
      <div className="text-center">
        <div className="text-xl font-bold">{followers?.count}</div>
        <div className="text-sm text-gray-500 dark:text-gray-400">Followers</div>
      </div>
      <div className="text-center">
        <div className="text-xl font-bold">{following?.count}</div>
        <div className="text-sm text-gray-500 dark:text-gray-400">Following</div>
      </div>
    </div>
  );
};

export default FollowersList;