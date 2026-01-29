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
import { useFeed } from "../context/FeedContext";
import Post from "../components/Post";
const NormalPostDetails = lazy(() => import("../Pages/NormalPostDetails"));
import { useUser } from "../context/user";
import axios from "axios";
import type { ExePostProps, PostProps, NormalPostProps } from "../types/Post";
import CircleLoader from "../components/Loader/CircleLoader";
import TickerBar from "../components/Home/TickerBar";
import ArticleOverlay from "./ArticleView";
import UploadBox from "../components/Home/Upload";
import { useSearch } from "../components/Home/SearchContext";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useFeedback } from "../context/FeedbackProvider";
import { useNavigate } from "react-router-dom";
// Lazy-loaded components
const ProfileCover = lazy(() => import("../components/Home/Profile"));
import Billboard from "../components/Home/Billboard";
const Right = lazy(() => import("../components/Home/Right"));
const AddPost = lazy(() => import("../components/Home/AddPost"));
const Music = lazy(() => import("../components/Music"));
const PostModal = lazy(() => import("../components/PostModal"));
const MessagingComponent = lazy(() => import("../components/Home/Message"));
const PostDetails = lazy(() => import("../Pages/PostDetail"));
const Profile = lazy(() => import("../components/Profile/NewProfile"));
const DevlogPostDetails = lazy(() => import("../Pages/DevlogPostDetails"));



function Home() {
  const { user } = useUser();
  const { open } = useFeedback();
  const navigate = useNavigate();
  const BACKEND_URL =
    import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
  // Feed state
  const [loading, setLoading] = useState(false);
  const {
    posts: mainPosts,
    setPosts: setMainPosts,
    nextCursor,
    setNextCursor,
    hasMore,
    setHasMore,
    scrollY,
    setScrollY,
  } = useFeed();

  // Search feed state
  const [filteredPosts, setFilteredPosts] = useState<PostProps[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [postDetailsOpen, setPostDetailsOpen] = useState(false);
  const [articleOpen, setArticleOpen] = useState(false);
  const [showWishlistFeed, setShowWishlistFeed] = useState(false);
  const [wishlistPosts, setWishlistPosts] = useState<PostProps[]>([]);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [activeCanvasId, setActiveCanvasId] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<PostProps | null>(null);
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const highlightPostId = searchParams.get("post");
  const [highlightPost, setHighlightPost] = useState<PostProps | null>(null);

  const {
    submittedQuery,
    showFilteredFeed,
    setShowFilteredFeed,
    setSubmittedQuery,
  } = useSearch();

  const [isUploading, setIsUploading] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const loaderRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const saveScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener("scroll", saveScroll);
    return () => window.removeEventListener("scroll", saveScroll);
  }, []);
  const loadWishlist = useCallback(async () => {
    try {
      setWishlistLoading(true);

      const res = await axios.get(`${BACKEND_URL}/api/wishlist/mine`, {
        withCredentials: true,
      });

      setWishlistPosts(res.data);
      console.log("Wishlist posts:", res.data);
      setShowWishlistFeed(true);   // 👈 this activates center replacement
    } catch (err) {
      console.error("Failed to load wishlist posts:", err);
    } finally {
      setWishlistLoading(false);
    }
  }, [BACKEND_URL]);

  useEffect(() => {
    if (scrollY > 0) {
      window.scrollTo(0, scrollY);
    }
  }, []);

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
        console.log("The posts are ", newPosts);
        const newCursor = res.data.nextCursor;

        setMainPosts((prev: PostProps[]) => {
          const all = reset ? newPosts : [...prev, ...newPosts];
          return Array.from(new Map(all.map((p: PostProps) => [p._id, p])).values()) as PostProps[];
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
  const handleUploadClick = () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    setIsUploading(true);
  };
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
  useEffect(() => {
    if (!highlightPostId) return;

    axios.get(`${BACKEND_URL}/api/posts/${highlightPostId}`)
      .then(res => setHighlightPost(res.data))
      .catch(() => setHighlightPost(null));
  }, [highlightPostId]);
  useEffect(() => {
    if (!highlightPost) return;

    setSelectedPost(highlightPost);
    setPostDetailsOpen(true);

    // Remove query param so refresh doesn't reopen
    const url = new URL(window.location.href);
    url.searchParams.delete("post");
    window.history.replaceState({}, "", url.toString());

  }, [highlightPost]);

  // Load feed on mount
  useEffect(() => {
    if (mainPosts.length === 0) {
      fetchMainPosts(true);
    }
  }, [])

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
    <div className="min-h-screen bg-gray-100 dark:bg-[#191919]">
      <Header />
      {/* <TickerBar /> */}

      <main className="max-w-7xl mx-auto pl-2 sm:pl-4 lg:pl-6 pr-4 sm:pr-6 lg:pr-8 pt-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left sidebar */}
          <div className="lg:col-span-2">
            {/* border-[3px] border-gray-400 dark:border-gray-700 shadow-lg */}
            <div className="
  sticky top-20 h-54 bg-white dark:bg-[#151515] rounded-t-xl">

              <Suspense fallback={null}>
                <ProfileCover onOpenWishlist={loadWishlist} setProfileOpen={setProfileOpen} />
              </Suspense>
            </div>
            <div className="sticky top-80">
              <UploadBox onUploadClick={handleUploadClick} />
            </div>
          </div>

          {/* Upload */}
          {isUploading && (
            <div className="lg:col-span-10 flex justify-center min-h-[80vh] w-full">
              <Suspense fallback={null}>
                <PostModal onCancel={() => setIsUploading(false)} />
              </Suspense>
            </div>
          )}

          {/* Profile */}
          {profileOpen && !isUploading && (
            <div className="lg:col-span-10 flex justify-center min-h-[80vh] w-full">
              <Suspense fallback={null}>
                <Profile setProfileOpen={setProfileOpen} />
              </Suspense>
            </div>
          )}

          {/* MODEL POST → replace center + right */}
          {postDetailsOpen &&
            selectedPost?.type === "model_post" &&
            !isUploading &&
            !profileOpen && (
              <div className="lg:col-span-10 min-h-[80vh] w-full">
                <Suspense fallback={null}>
                  <PostDetails
                    post={selectedPost as ExePostProps}
                    onClose={() => {
                      setPostDetailsOpen(false);
                      setSelectedPost(null);
                    }}
                  />
                </Suspense>
              </div>
            )}
          {/* ARTICLE POST → replace center + right */}
          {articleOpen && activeCanvasId && !isUploading && !profileOpen && (
            <div className="lg:col-span-10 min-h-[80vh] w-full pt-3">
              <Suspense fallback={null}>
                <ArticleOverlay
                  canvasId={activeCanvasId}
                  onClose={() => {
                    setArticleOpen(false);
                    setActiveCanvasId(null);
                  }}
                />
              </Suspense>
            </div>
          )}


          {/* CENTER */}
          {!isUploading &&
            !articleOpen &&
            !profileOpen &&
            !(postDetailsOpen && selectedPost?.type === "model_post") && (
              <div className="lg:col-span-6 flex flex-col items-center justify-start min-h-[80vh] w-full">
                {/* NORMAL POST → center only */}
                {postDetailsOpen &&
                  selectedPost &&
                  selectedPost.type !== "model_post" ? (
                  <Suspense fallback={null}>

                    {selectedPost.type === "devlog_post" ? (
                      <DevlogPostDetails
                        post={selectedPost}
                        BACKEND_URL={BACKEND_URL}
                        onClose={() => {
                          setPostDetailsOpen(false);
                          setSelectedPost(null);
                        }}
                      />
                    ) : (
                      <NormalPostDetails
                        post={selectedPost as NormalPostProps}
                        BACKEND_URL={BACKEND_URL}
                        onClose={() => {
                          setPostDetailsOpen(false);
                          setSelectedPost(null);
                        }}
                      />
                    )}

                  </Suspense>
                ) : showWishlistFeed ? (
                  /* WISHLIST FEED */
                  <div className="w-full mt-4 flex flex-col">
                    <button
                      onClick={() => {
                        setShowWishlistFeed(false);
                        setWishlistPosts([]);
                      }}
                      className="flex items-center gap-2 text-blue-500 hover:text-blue-600 mb-4"
                    >
                      <ArrowLeft size={20} /> Back to Feed
                    </button>

                    {wishlistLoading && <CircleLoader />}

                    {!wishlistLoading && wishlistPosts.length === 0 && (
                      <div className="text-gray-400 dark:text-gray-500 mt-4">
                        No wishlist posts found
                      </div>
                    )}

                    {wishlistPosts.map((post) => (
                      <Post
                        key={post._id}
                        {...post}
                        onOpenDetails={() => {
                          setSelectedPost(post);
                          setPostDetailsOpen(true);
                        }}
                      />
                    ))}
                  </div>

                ) : showFilteredFeed ? (
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
                      <Post
                        key={post._id}
                        {...post}
                        onOpenDetails={() => {
                          setSelectedPost(post);
                          setPostDetailsOpen(true);
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <>
                    {mainPosts.length > 0 && (
                      <div className="w-full mt-4 flex flex-col">
                        {highlightPost && (
                          <Post
                            {...highlightPost}
                            onOpenDetails={() => {
                              setSelectedPost(highlightPost);
                              setPostDetailsOpen(true);
                            }}
                          />
                        )}

                        {mainPosts
                          .filter(p => p._id !== highlightPost?._id)
                          .map((post) => (
                            <Post
                              key={post._id}
                              {...post}
                              onOpenDetails={() => {
                                setSelectedPost(post);
                                setPostDetailsOpen(true);
                              }}
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
            )}

          {/* RIGHT SIDEBAR (hidden only for model post) */}
          {!isUploading &&
            !profileOpen &&
            !(postDetailsOpen && selectedPost?.type === "model_post") && !articleOpen && (
              <div className="lg:col-span-4 hidden lg:block h-full">
                <div className="sticky top-20">
                  <div className="h-[500px] overflow-hidden">
                    <Suspense fallback={null}>
                      <Billboard
                        // activeFace={activeFace}
                        onOpenArticle={(canvasId: string) => {
                          setActiveCanvasId(canvasId);
                          setArticleOpen(true);
                        }}
                      />
                    </Suspense>
                  </div>
                </div>
              </div>
            )}
        </div>
      </main>

      <Suspense fallback={null}>
        <MessagingComponent />
      </Suspense>
    </div>
  );

}

export default Home;
