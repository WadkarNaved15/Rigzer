import { useEffect, useState, useRef } from "react";
import axios from "axios";
import Post from "../components/Post";
import CircleLoader from "../components/Loader/CircleLoader";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { PostProps } from "../types/Post";

const WishlistPage = () => {
  const BACKEND_URL =
    import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

  const navigate = useNavigate();
  const scrollPositionRef = useRef<number>(0);

  const [posts, setPosts] = useState<PostProps[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadWishlist = async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/api/wishlist/mine`, {
          withCredentials: true,
        });

        setPosts(res.data);
      } catch (err) {
        console.error("Failed to load wishlist posts:", err);
      } finally {
        setLoading(false);
      }
    };

    loadWishlist();
  }, []);

  return (
    <div className="w-full mt-4 flex flex-col">
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-blue-500 hover:text-blue-600 mb-4"
      >
        <ArrowLeft size={20} /> Back to Feed
      </button>

      {loading && (
        <div className="w-full flex justify-center mt-4">
          <CircleLoader />
        </div>
      )}

      {!loading && posts.length === 0 && (
        <div className="text-gray-400 dark:text-gray-500 mt-4">
          No wishlist posts found
        </div>
      )}

      {!loading &&
        posts.map((post) => (
          <Post
            key={post._id}
            {...post}
            onOpenDetails={() => {
              scrollPositionRef.current = window.scrollY;
              navigate(`/post/${post._id}`, { state: { post } });
            }}
          />
        ))}
    </div>
  );
};

export default WishlistPage;