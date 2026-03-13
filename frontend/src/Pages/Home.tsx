// src/pages/Home.tsx
import {
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { useSearchParams } from "react-router-dom";
import { useFeed } from "../context/FeedContext";
import Post from "../components/Post";
import axios from "axios";
import type { PostProps } from "../types/Post";
import CircleLoader from "../components/Loader/CircleLoader";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

function Home() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const isSearch = query.length > 0;
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
  const searchAbortRef = useRef<AbortController | null>(null);
  const [filteredPosts, setFilteredPosts] = useState<PostProps[]>([]);
  const [searchExecuted, setSearchExecuted] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchCursor, setSearchCursor] = useState<string | null>(null);
  const [searchHasMore, setSearchHasMore] = useState(true);
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
  const fetchRef = useRef(fetchMainPosts);

  useEffect(() => {
    fetchRef.current = fetchMainPosts;
  }, [fetchMainPosts]);
  // ── Fetch Filtered Posts ─────────────────────────────────────────────────
  const fetchFilteredPosts = useCallback(
    async (query: string, reset = false) => {
      if (!query.trim()) return;
      if (searchLoading) return;
      if (!reset && !searchHasMore) return;

      setSearchLoading(true);
      setSearchExecuted(true);

      try {
        const res = await axios.get(`${BACKEND_URL}/api/posts/filter_posts`, {
          params: {
            query,
            cursor: reset ? null : searchCursor,
            limit: 5,
          },
        });

        const newPosts = res.data.posts;
        const newCursor = res.data.nextCursor;
        setFilteredPosts((prev: PostProps[]) => {
          const all: PostProps[] = reset ? newPosts : [...prev, ...newPosts];

          const uniquePosts: PostProps[] = Array.from(
            new Map<string, PostProps>(
              all.map((p: PostProps) => [p._id, p])
            ).values()
          );

          return uniquePosts;
        });

        setSearchCursor(newCursor);

        if (!newCursor) {
          setSearchHasMore(false);
        }
      } catch (err) {
        console.error("Failed to fetch filtered posts:", err);
      } finally {
        setSearchLoading(false);
      }
    },
    [searchCursor, searchHasMore, BACKEND_URL]
  );
  // ── Initial Load ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (mainPosts.length === 0 && !isSearch) {
      fetchMainPosts(true);
    }
  }, [mainPosts.length, isSearch]);

  // ── Search Trigger ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!query) {
      setFilteredPosts([]);
      setSearchExecuted(false);
      return;
    }

    setFilteredPosts([]);
    setSearchCursor(null);
    setSearchHasMore(true);

    fetchFilteredPosts(query, true);
  }, [query]);
  // ── Infinite Scroll ──────────────────────────────────────────────────────
  useEffect(() => {
    if (isSearch ? !searchHasMore : !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;

        if (isSearch) {
          fetchFilteredPosts(query);
        } else {
          fetchRef.current();
        }
      },
      { rootMargin: "1200px" }
    );

    const loader = loaderRef.current;

    if (loader) observer.observe(loader);

    return () => observer.disconnect();
  }, [hasMore, searchHasMore, isSearch, query, fetchFilteredPosts]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center min-h-[80vh] w-full">

      {/* SEARCH FEED */}
      {isSearch ? (
        <div className="w-full mt-4 flex flex-col md:px-0 px-0">
          <button
            onClick={() => {
              navigate("/");
            }}
            className="flex items-center gap-2 text-blue-500 hover:text-blue-600 mb-4"
          >
            <ArrowLeft size={20} />
            Back to Feed
          </button>

          {searchLoading && <CircleLoader />}

          {!searchLoading && searchExecuted && filteredPosts.length === 0 && (
            <div className="text-gray-400 dark:text-gray-500 mt-4">
              No posts found for "{query}"
            </div>
          )}

          {filteredPosts.map((post) => (
            <Post
              key={post._id}
              {...post}
              onOpenDetails={() =>
                navigate(`/post/${post._id}`, {
                  state: { post }
                })
              }
            />
          ))}

          {/* Loader for infinite scroll */}
          <div ref={loaderRef} className="h-10 w-full" />
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