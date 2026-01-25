// FollowFace.tsx
import { useEffect, useState } from "react";
import axios from "axios";
import { useUser } from "../../context/user";
import FollowButton from "../FollowButton";

const FollowFace = ({ translateZ }: { translateZ: number }) => {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
  const { user } = useUser();
  const [users, setUsers] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const avatar="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
  useEffect(() => {
    if (!user?._id) return;

    const fetchUsers = async () => {
      try {
        const res = await axios.get(
          `${BACKEND_URL}/api/follow/${user._id}/suggested`,
          { withCredentials: true }
        );
        setUsers(res.data.users || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoaded(true);
      }
    };

    fetchUsers();
  }, [user?._id]);

  if (!loaded) return null; // ⬅️ important: no empty flash

  return (
    <div
      className="face dark:text-white dark:bg-[#191919] overflow-y-auto"
      style={{ transform: `translateZ(${translateZ}px)` }}
    >
      <div className="h-full space-y-4 px-2">
        {users.length === 0 ? (
          <p className="text-gray-500">No users to follow</p>
        ) : (
          users.map((u) => (
            <div key={u._id} className="flex justify-between items-center gap-4">
              <img src={avatar} className="w-12 h-12 rounded-full" />
              <div>
                <h3 className="font-semibold">{u.name}</h3>
                <p className="text-sm text-gray-500">@{u.username}</p>
              </div>
              <FollowButton userId={user!._id} targetId={u._id} />
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default FollowFace;
