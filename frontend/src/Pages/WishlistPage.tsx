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
  const [posts, setPosts] = useState<PostProps[]>([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const loaderRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const [isFetching, setIsFetching] = useState(false);
  const scrollPositionRef = useRef<number>(0);

  const fetchWishlist = async () => {
    if (!hasMore || isFetching) return; // ✅ guard

    setIsFetching(true);

    try {
      const res = await axios.get(`${BACKEND_URL}/api/wishlist/mine`, {
        params: { cursor, limit: 10 },
        withCredentials: true,
      });

      setPosts((prev) => {
        const newPosts = res.data.posts;
        const existingIds = new Set(prev.map((p) => p._id));

        const filtered = newPosts.filter((p: PostProps) => !existingIds.has(p._id));

        return [...prev, ...filtered];
      });
      setCursor(res.data.nextCursor);

      if (!res.data.nextCursor) setHasMore(false);
    } catch (err) {
      console.error("Failed to load wishlist posts:", err);
    } finally {
      setLoading(false);
      setIsFetching(false);
    }
  };
  useEffect(() => {
    fetchWishlist();
  }, []);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchWishlist();
        }
      },
      {
        rootMargin: "300px",
        threshold: 0,
      }
    );

    const current = loaderRef.current;
    if (current) observer.observe(current);

    return () => {
      if (current) observer.unobserve(current);
    };
  }, [fetchWishlist]); // ✅ stable dependency
  return (
    <div className="w-full mt-4 flex flex-col">
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-blue-500 hover:text-blue-600 mb-4"
      >
        <ArrowLeft size={20} /> Back to Feed
      </button>

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
      <div ref={loaderRef} className="h-10 flex justify-center items-center">
        {hasMore && <CircleLoader />}
      </div>
    </div>
  );
};

export default WishlistPage;