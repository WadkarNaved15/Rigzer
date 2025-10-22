import React, { useState, useEffect, useRef, useMemo } from "react";
import axios from "axios";
import { PlusCircle } from "lucide-react";
import { useUser } from "../../context/user";
import FollowButton from "../FollowButton";

type Face = "follow" | "posts" | "reading" | "projects";

interface TowerProps {
  activeFace: Face;
}

const Tower: React.FC<TowerProps> = ({ activeFace }) => {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
  const { user } = useUser();
  const cubeRef = useRef<HTMLDivElement>(null);
  const [translateZ, setTranslateZ] = useState(150);

  // Recompute translateZ on mount + resize
  useEffect(() => {
    const update = () => {
      if (cubeRef.current) {
        setTranslateZ(cubeRef.current.offsetWidth / 2);
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Map active face to rotation
  const rotation = useMemo(() => {
    const map: Record<Face, string> = {
      follow: "rotateY(0deg)",
      posts: "rotateY(-90deg)",
      reading: "rotateY(-180deg)",
      projects: "rotateY(-270deg)",
    };
    return map[activeFace];
  }, [activeFace]);

const FollowFace: React.FC = () => {
  const [users, setUsers] = useState<
    { _id: string; name: string; username: string; avatar: string }[]
  >([]);

  // Fetch users to follow from backend
useEffect(() => {
  const fetchUsers = async () => {
    try {
      const userId = user?.id; // get current logged-in user's ID from context or props
      const res = await axios.get(
      `${BACKEND_URL}/api/follow/${userId}/suggested`,
        {
          withCredentials: true, // send cookies if using sessions/auth
        }
      );
      setUsers(res.data.users); // set users from backend
    } catch (err) {
      console.error("Failed to fetch suggested users:", err);
    }
  };

  fetchUsers();
}, [user?.id]);

  return (
    <div
      className="face dark:text-white dark:bg-black overflow-y-auto"
      style={{ transform: `translateZ(${translateZ}px)` }}
    >
      <div className="h-full space-y-4 px-2">
 {users.length === 0 ? (
  <p className="text-gray-500 dark:text-gray-400">No users to follow</p>
) : (
  users.map((activeUser) => {
    // --- Here is the console log you requested ---
    console.log(activeUser);
    // -------------------------------------------

    return (
      <div key={activeUser._id} className="flex items-center justify-between gap-4">
        <img
          src={activeUser.avatar || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"}
          alt={activeUser.name}
          className="w-12 h-12 rounded-full"
        />
        <div>
          <h3 className="font-semibold">{activeUser.name}</h3>
          <p className="text-sm text-gray-500">@{activeUser.username}</p>
        </div>
        {user && (
          <FollowButton userId={user.id} targetId={activeUser._id} />
        )}
      </div>
    );
  })
)}
      </div>
    </div>
  );
};


  const PostsFace = () => (
    <div
      className="face dark:text-white dark:bg-black overflow-y-auto"
      style={{ transform: `rotateY(90deg) translateZ(${translateZ}px)` }}
    >
      <div className="h-full space-y-4 px-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="border-b pb-4">
            <div className="flex items-center gap-2 mb-2">
              <img
                src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                alt={`Author ${i + 1}`}
                className="w-8 h-8 rounded-full"
              />
              <span className="font-semibold mb-2">Author {i + 1}</span>
            </div>
            <p className="text-sm text-gray-600 mb-2 dark:text-gray-200">
              Sample post content that demonstrates layout and readability.
            </p>
          </div>
        ))}
      </div>
    </div>
  );

  const ReadingFace = () => (
    <div
      className="face dark:text-white dark:bg-black overflow-y-auto"
      style={{ transform: `rotateY(180deg) translateZ(${translateZ}px)` }}
    >
      <div className="h-full space-y-4 px-2">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="border-b pb-4">
            <h3 className="font-semibold mb-2">Article Title {i + 1}</h3>
            <p className="text-sm text-gray-600 mb-2 dark:text-gray-200">
              Brief description of article content to give a preview.
            </p>
          </div>
        ))}
      </div>
    </div>
  );

  const ProjectsFace = () => (
    <div
      className="face dark:text-white dark:bg-black overflow-y-auto"
      style={{ transform: `rotateY(-90deg) translateZ(${translateZ}px)` }}
    >
      <div className="h-full space-y-4 px-2">
        <h3 className="font-semibold mb-2">Projects</h3>
        <ul className="list-disc pl-6 text-gray-600 dark:text-gray-200 space-y-1">
          <li>Voxel Sandbox</li>
          <li>Roguelike Toolkit</li>
          <li>WebGL Racer</li>
        </ul>
      </div>
    </div>
  );

  return (
    <div className="flex-1 dark:bg-black h-full w-full overflow-hidden flex items-center justify-center perspective-1000">
      <div
        ref={cubeRef}
        className="relative w-full h-full flex justify-center preserve-3d transition-transform duration-700"
        style={{ transform: rotation }}
      >
        <FollowFace />
        <PostsFace />
        <ReadingFace />
        <ProjectsFace />
      </div>
    </div>
  );
};

export default Tower;
