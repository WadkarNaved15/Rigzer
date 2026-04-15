import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useUser } from "../../context/user";
import FollowButton from "../FollowButton";
import { useNavigate } from "react-router-dom";

const FollowFace = ({ translateZ }: { translateZ: number }) => {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
  const { user } = useUser();
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const prevUserIdRef = useRef<string | null>(null);
  const fetchedRef = useRef(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // If no user, we consider it "loaded" so we can show the login prompt
    if (!user?._id) {
      setLoaded(true);
      return;
    }

    if (fetchedRef.current && prevUserIdRef.current === user._id) return;

    prevUserIdRef.current = user._id;
    fetchedRef.current = true;

    const fetchUsers = async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/api/follow/${user._id}/suggested`, { withCredentials: true });
        setUsers(res.data.users || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoaded(true);
      }
    };
    fetchUsers();
  }, [user?._id]);

  if (!loaded) return null;

  return (
    <div
      className="absolute inset-0 face bg-[#F9FAFB] dark:bg-[#191919] text-gray-900 dark:text-white overflow-y-auto backface-hidden"
      style={{ transform: `translateZ(${translateZ}px)` }}
    >
      <div className="h-full px-3 py-2 lg:px-4 lg:py-3 2xl:px-5 2xl:py-4 flex flex-col">
        <h3 className="text-[10px] 2xl:text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-4">
          Suggested
        </h3>

        {!user ? (
          /* LOGIN PROMPT SECTION */
          <div className="flex flex-col items-center justify-center flex-grow space-y-4 pb-10">
            <div className="space-y-2">
              <p className="text-lg lg:text-xl font-bold text-gray-900 dark:text-gray-100 text-center px-6">
                Login to follow other users
              </p>
              <p className="text-sm text-gray-500 text-center">
                Join the community to stay updated
              </p>
            </div>
          </div>
        ) : users.length === 0 ? (
          <p className="text-gray-500 text-xs">No users to follow</p>
        ) : (
          <div className="space-y-3 lg:space-y-4 2xl:space-y-5">
            {users.map((u) => (
              <div key={u._id} className="flex justify-between items-center gap-3 2xl:gap-4 group">
                <div className="flex items-center gap-3">
                  <img
                    src={u.avatar || "/default_avatar.png"}
                    className="w-9 h-9 lg:w-10 lg:h-10 2xl:w-12 2xl:h-12 rounded-full border border-gray-200 dark:border-white/10 object-cover"
                  />
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate text-xs lg:text-sm 2xl:text-base w-24 lg:w-32 2xl:w-40 text-gray-900 dark:text-gray-100">
                      {u.name || u.username}
                    </h3>
                    <p className="text-gray-500 truncate text-[9px] lg:text-[10px] 2xl:text-xs">
                      @{u.username}
                    </p>
                  </div>
                </div>
                <div className="flex-shrink-0 2xl:scale-105 origin-right">
                  <FollowButton targetId={u._id} initialFollowing={u.isFollowing} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FollowFace;