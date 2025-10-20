// src/pages/Home.tsx
import {
  useEffect,
  useState,
  useCallback,
  Suspense,
  lazy,
  useRef,
} from "react";
import { Header } from "../components/Header";
import Post from "../components/Post";
import { useUser } from "../context/user";
import axios from "axios";
import type { PostProps } from "../types/Post";
import CircleLoader from "../components/Loader/CircleLoader";
import TickerBar from "../components/Home/TickerBar";
import UploadBox from "../components/Home/Upload";
import { useSearch } from "../components/Home/SearchContext";
import { ArrowLeft } from "lucide-react";
import { useFeedback } from "../context/FeedbackProvider";

// Lazy-loaded components
const ProfileCover = lazy(() => import("../components/Home/Profile"));
const Billboard = lazy(() => import("../components/Home/Billboard"));
const Right = lazy(() => import("../components/Home/Right"));
const AddPost = lazy(() => import("../components/Home/AddPost"));
const Music = lazy(() => import("../components/Music"));
const PostModal = lazy(() => import("../components/Home/NewPost"));
const MessagingComponent = lazy(() => import("../components/Home/Message"));
const Profile = lazy(() => import("../components/Profile/NewProfile"));

function Home() {
  const { user } = useUser();
  const { open } = useFeedback();
  const BACKEND_URL =
    import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

  // Feed state
  const [mainPosts, setMainPosts] = useState<PostProps[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Search feed state
  const [filteredPosts, setFilteredPosts] = useState<PostProps[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const {
    submittedQuery,
    showFilteredFeed,
    setShowFilteredFeed,
    setSubmittedQuery,
  } = useSearch();

  const [isUploading, setIsUploading] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const loaderRef = useRef<HTMLDivElement | null>(null);

  // Fetch main posts
  const fetchMainPosts = useCallback(
    async (reset = false) => {
      if (loading || (!hasMore && !reset)) return;
      setLoading(true);

      try {
        const res = await axios.get(`${BACKEND_URL}/api/posts/fetch_posts`, {
          params: { cursor: reset ? null : nextCursor, limit: 3 },
        });

        const newPosts = res.data.posts;
        const newCursor = res.data.nextCursor;

        setMainPosts((prev) => {
          const all = reset ? newPosts : [...prev, ...newPosts];
          return Array.from(new Map(all.map((p) => [p._id, p])).values());
        });

        setNextCursor(newCursor);
        if (!newCursor || newPosts.length === 0) setHasMore(false);
      } catch (err) {
        console.error("Failed to fetch posts:", err);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [nextCursor, loading, hasMore, BACKEND_URL]
  );

  // Fetch filtered posts
  const fetchFilteredPosts = useCallback(
    async (query: string) => {
      if (!query.trim()) return;
      setSearchLoading(true);
      try {
        const res = await axios.get(`${BACKEND_URL}/api/posts/filter_posts`, {
          params: { query },
        });

        const newPosts = res.data.posts;
        setFilteredPosts((prev) => {
          const all = [...prev, ...newPosts];
          return Array.from(new Map(all.map((p) => [p._id, p])).values());
        });
      } catch (err) {
        console.error("Failed to fetch filtered posts:", err);
      } finally {
        setSearchLoading(false);
      }
    },
    [BACKEND_URL]
  );

  // Load feed on mount
  useEffect(() => {
    fetchMainPosts(true);
  }, []);

  // Handle search query
  useEffect(() => {
    if (submittedQuery.trim()) {
      setShowFilteredFeed(true);
      fetchFilteredPosts(submittedQuery);
    }
  }, [submittedQuery]);

  // Infinite scroll (main feed only)
  useEffect(() => {
    if (!hasMore || loading || showFilteredFeed) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) fetchMainPosts();
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

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-black">
      <Header />
      <TickerBar />

      <main className="max-w-7xl mx-auto pl-2 sm:pl-4 lg:pl-6 pr-4 sm:pr-6 lg:pr-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left sidebar */}
          <div className="lg:col-span-2">
            <div className="sticky top-24 shadow-2xl h-54 dark:bg-black bg-white rounded-t-xl border-t border-r border-gray-200 dark:border-[#3D7A6E]">
              <Suspense fallback={null}>
                <ProfileCover setProfileOpen={setProfileOpen} />
              </Suspense>
            </div>
            <div className="sticky top-80">
              <UploadBox onUploadClick={() => setIsUploading(true)} />
            </div>
          </div>

          {/* Center + Right */}
          {isUploading ? (
            <div className="lg:col-span-10 flex flex-col items-center justify-start min-h-[80vh] w-full">
              <Suspense fallback={null}>
                <PostModal onCancel={() => setIsUploading(false)} />
              </Suspense>
            </div>
          ) : profileOpen ? (
            <div className="lg:col-span-10 flex flex-col items-center justify-start min-h-[80vh] w-full">
              <Suspense fallback={null}>
                <Profile setProfileOpen={setProfileOpen}  />
              </Suspense>
            </div>
          ) : (
            <>
              {/* Center Feed */}
              <div className="lg:col-span-6 flex flex-col items-center justify-start min-h-[80vh] w-full">
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
                      <ArrowLeft size={20} /> Back to Feed
                    </button>

                    {searchLoading && <CircleLoader />}
                    {!searchLoading && filteredPosts.length === 0 && (
                      <div className="text-gray-400 dark:text-gray-500 mt-4">
                        No posts found for "{submittedQuery}"
                      </div>
                    )}
                    {filteredPosts.map((post) => (
                      <Post key={post._id} {...post} />
                    ))}
                  </div>
                ) : (
                  <>
                    {mainPosts.length > 0 && (
                      <div className="w-full mt-4 flex flex-col">
                        {mainPosts.map((post) => (
                          <Post key={post._id} {...post} />
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

              {/* Billboard */}
              <div className="lg:col-span-4 hidden lg:block h-full">
                <div className="sticky top-24 h-[500px]">
                  <Suspense fallback={null}>
                    <Billboard />
                  </Suspense>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Footer components */}
      <Suspense fallback={null}>
        <MessagingComponent />
      </Suspense>
      {/* <Suspense fallback={null}>
        <Music />
      </Suspense> */}
    </div>
  );
}

export default Home;
