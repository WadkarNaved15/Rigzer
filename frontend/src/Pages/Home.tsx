// src/pages/Home.tsx
import {
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { useFeed } from "../context/FeedContext";
import Post from "../components/Post";
import axios from "axios";
import type { PostProps } from "../types/Post";
import CircleLoader from "../components/Loader/CircleLoader";
import { useSearch } from "../components/Home/SearchContext";
import { ArrowLeft } from "lucide-react";
import { useNavigate} from "react-router-dom";

function Home() {
  const navigate = useNavigate();
  const BACKEND_URL =
    import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

  const {
    posts: mainPosts,
    setPosts: setMainPosts,
    nextCursor,
    setNextCursor,
    hasMore,
    setHasMore,
  } = useFeed();

  const [loading, setLoading] = useState(false);
  const loaderRef = useRef<HTMLDivElement | null>(null);

  // Search
  const {
    submittedQuery,
    showFilteredFeed,
    setShowFilteredFeed,
    setSubmittedQuery,
  } = useSearch();

  const [filteredPosts, setFilteredPosts] = useState<PostProps[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // ── Fetch Main Feed ──────────────────────────────────────────────────────
  const fetchMainPosts = useCallback(
    async (reset = false) => {
      if (loading || (!hasMore && !reset)) return;
      setLoading(true);

      try {
        const res = await axios.get(`${BACKEND_URL}/api/posts/fetch_posts`, {
          params: { cursor: reset ? null : nextCursor, limit: 5 },
          withCredentials: true,
        });

        const newPosts = res.data.posts;
        const newCursor = res.data.nextCursor;

        setMainPosts((prev) => {
          const all: PostProps[] = reset ? newPosts : [...prev, ...newPosts];
          const uniquePosts: PostProps[] = Array.from(
            new Map<string, PostProps>(
              all.map((p: PostProps) => [p._id, p])
            ).values()
          );
          return uniquePosts;
        });

        setNextCursor(newCursor);
        if (!newCursor || newPosts.length === 0) {
          setHasMore(false);
        }
      } catch (err) {
        console.error("Failed to fetch posts:", err);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [nextCursor, loading, hasMore, BACKEND_URL]
  );

  // ── Fetch Filtered Posts ─────────────────────────────────────────────────
  const fetchFilteredPosts = useCallback(
    async (query: string) => {
      if (!query.trim()) return;
      setSearchLoading(true);
      try {
        const res = await axios.get(`${BACKEND_URL}/api/posts/filter_posts`, {
          params: { query },
        });
        setFilteredPosts(res.data.posts);
      } catch (err) {
        console.error("Failed to fetch filtered posts:", err);
      } finally {
        setSearchLoading(false);
      }
    },
    [BACKEND_URL]
  );

  // ── Initial Load ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (mainPosts.length === 0) {
      fetchMainPosts(true);
    }
  }, []);

  // ── Search Trigger ───────────────────────────────────────────────────────
  useEffect(() => {
    if (submittedQuery.trim()) {
      setShowFilteredFeed(true);
      fetchFilteredPosts(submittedQuery);
    }
  }, [submittedQuery]);

  // ── Infinite Scroll ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!hasMore || loading || showFilteredFeed) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchMainPosts();
        }
      },
      { threshold: 1.0 }
    );

    const loader = loaderRef.current;
    if (loader) observer.observe(loader);

    return () => {
      if (loader) observer.unobserve(loader);
      observer.disconnect();
    };
  }, [fetchMainPosts, hasMore, loading, showFilteredFeed]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center min-h-[80vh] w-full">

      {/* SEARCH FEED */}
      {showFilteredFeed ? (
        <div className="w-full mt-4 flex flex-col">
          <button
            onClick={() => {
              setShowFilteredFeed(false);
              setSubmittedQuery("");
              setFilteredPosts([]);
            }}
            className="flex items-center gap-2 text-blue-500 hover:text-blue-600 mb-4"
          >
            <ArrowLeft size={20} />
            Back to Feed
          </button>

          {searchLoading && <CircleLoader />}

          {!searchLoading && filteredPosts.length === 0 && (
            <div className="text-gray-400 dark:text-gray-500 mt-4">
              No posts found for "{submittedQuery}"
            </div>
          )}

          {filteredPosts.map((post) => (
            <Post
              key={post._id}
              {...post}
              onOpenDetails={() =>
                navigate(`/post/${post._id}`, {
                  state: {
                    post,
                  }
                })
              }
            />
          ))}
        </div>
      ) : (
        <>
          {/* MAIN FEED */}
          {mainPosts.length > 0 && (
            <div className="w-full mt-4 flex flex-col">
              {mainPosts.map((post) => (
                <Post
                  key={post._id}
                  {...post}
                  onOpenDetails={() =>
                    navigate(`/post/${post._id}`, {
                      state: {
                        post,
                      }
                    })
                  }
                />
              ))}
            </div>
          )}

          {loading && mainPosts.length === 0 && (
            <div className="w-full flex justify-center mt-4">
              <CircleLoader />
            </div>
          )}

          {!hasMore && mainPosts.length > 0 && (
            <div className="text-gray-400 dark:text-gray-500 mt-4">
              You've reached the end.
            </div>
          )}

          <div ref={loaderRef} className="h-10 w-full" />
        </>
      )}
    </div>
  );
}

export default Home;