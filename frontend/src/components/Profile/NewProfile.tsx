import React from "react";
import { X, Youtube, Instagram, MessageSquare } from "lucide-react";
import FollowButton from "../FollowButton";
import type { ArticleProps } from "../../types/Article";
import FollowersList from "../FollowersList";
import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useScrollRestoration } from "../../hooks/useScrollRestoration";
import { saveProfileCache, getProfileCache, clearProfileCache } from "../../utils/profileCache";
import type { ProfileUser } from "../../utils/profileCache"; // ← import shared type
import Post from "../Post";
import { useChat } from "../../context/ChatContext";
import EditProfileModal from "./EditProfileModal";
import type { PostProps } from "../../types/Post";
import { useUser } from "../../context/user";
import axios from "axios";

const ProfilePage: React.FC = () => {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
  const { username } = useParams<{ username: string }>();
  const { user } = useUser();
  const navigate = useNavigate();
  const { openChatWith } = useChat();

  // Cache is read ONCE at mount — ProfilePageWrapper's key={username}
  // guarantees this component fully remounts on username change,
  // so cachedRef is always fresh for the correct user.
  const cachedRef = useRef(username ? getProfileCache(username) : null);
  const cached = cachedRef.current;

  const [profileUser, setProfileUser] = useState<ProfileUser | null>(cached?.profileUser ?? null);
  const [userPosts, setUserPosts] = useState<PostProps[]>(cached?.posts ?? []);
  const [cursor, setCursor] = useState<string | null>(cached?.cursor ?? null);
  const [hasMorePosts, setHasMorePosts] = useState(cached?.hasMore ?? true);
  const [userArticles, setUserArticles] = useState<ArticleProps[]>(cached?.articles ?? []);
  const [loadingProfile, setLoadingProfile] = useState(!cached);
  const [loadingPosts, setLoadingPosts] = useState(!cached);
  const [loadingArticles, setLoadingArticles] = useState(!cached);
  const [editOpen, setEditOpen] = useState(false);

  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const fetchingRef = useRef(false);
  // Separate guards for posts vs articles — no shared requestUserRef confusion
  const activeFetchIdRef = useRef<string | null>(null);
  const activeArticleFetchIdRef = useRef<string | null>(null);
  const isOwnProfile = user?._id === profileUser?._id;

  const contentReady = !loadingProfile && userPosts.length > 0;
  const savedScrollY = cached?.scrollY ?? 0;

  useScrollRestoration(`profile_${username}`, savedScrollY, contentReady);

  // ── Save to cache on unmount ──────────────────────────────────────────────
  const stateRef = useRef({ userPosts, cursor, hasMorePosts, userArticles, profileUser });
  const usernameRef = useRef(username);

  useEffect(() => {
    stateRef.current = { userPosts, cursor, hasMorePosts, userArticles, profileUser };
    usernameRef.current = username;
  });

  useEffect(() => {
    return () => {
      const u = usernameRef.current;
      if (!u || !stateRef.current.profileUser) return;
      saveProfileCache(u, {
        profileUser: stateRef.current.profileUser,
        posts: stateRef.current.userPosts,
        cursor: stateRef.current.cursor,
        hasMore: stateRef.current.hasMorePosts,
        articles: stateRef.current.userArticles,
        scrollY: window.scrollY,
      });
    };
  }, []);

  // ── Fetch profile (always refresh, but don't block if cached) ────────────
  useEffect(() => {
    const fetchProfile = async () => {
      if (!username) return;
      try {
        const res = await axios.get(`${BACKEND_URL}/api/users/username/${username}`);
        if (usernameRef.current !== username) return; // stale guard
        setProfileUser(res.data);
      } catch (err) {
        console.error("Failed to load profile", err);
      } finally {
        if (usernameRef.current === username) setLoadingProfile(false);
      }
    };
    fetchProfile();
  }, [username]);

  // ── Fetch posts ──────────────────────────────────────────────────────────
  const fetchPosts = async (cursorParam: string | null = null) => {
    if (!profileUser?._id) return;
    if (!hasMorePosts && cursorParam !== null) return;

    const fetchId = profileUser._id;
    activeFetchIdRef.current = fetchId;
    setLoadingPosts(true);

    try {
      const res = await axios.get(
        `${BACKEND_URL}/api/posts/user_posts/${fetchId}`,
        { params: { cursor: cursorParam, limit: 10 } }
      );
      if (activeFetchIdRef.current !== fetchId) return;
      setUserPosts((prev) =>
        cursorParam === null ? res.data.posts : [...prev, ...res.data.posts]
      );
      setCursor(res.data.nextCursor);
      if (!res.data.nextCursor) setHasMorePosts(false);
    } catch (err) {
      console.error("Failed to load posts", err);
    } finally {
      if (activeFetchIdRef.current === fetchId) setLoadingPosts(false);
    }
  };

  // ── Fetch posts on profile load (skip if cache is valid) ─────────────────
  useEffect(() => {
    if (!profileUser?._id) return;
    if (cachedRef.current?.posts?.length) return;
    fetchPosts(null);
  }, [profileUser?._id]);

  // ── Fetch articles on profile load (skip if cache is valid) ──────────────
  useEffect(() => {
    if (!profileUser?._id) return;
    if (cachedRef.current?.articles?.length) return; // ← uses cachedRef, not requestUserRef

    const fetchId = profileUser._id;
    activeArticleFetchIdRef.current = fetchId;

    const fetchArticles = async () => {
      try {
        const res = await axios.get(
          `${BACKEND_URL}/api/articles/published/user/${fetchId}`
        );
        if (activeArticleFetchIdRef.current !== fetchId) return; // stale guard
        setUserArticles(res.data);
      } catch (err) {
        console.error("Failed to load articles", err);
      } finally {
        if (activeArticleFetchIdRef.current === fetchId) setLoadingArticles(false);
      }
    };

    fetchArticles();
  }, [profileUser?._id, BACKEND_URL]);

  // ── Infinite scroll ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!loadMoreRef.current || !profileUser?._id) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && hasMorePosts && !loadingPosts && !fetchingRef.current) {
          fetchingRef.current = true;
          fetchPosts(cursor).finally(() => { fetchingRef.current = false; });
        }
      },
      { root: null, rootMargin: "600px", threshold: 0 }
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [cursor, hasMorePosts, loadingPosts, profileUser?._id]);

  if (loadingProfile && !profileUser) {
    return <div className="p-10 text-gray-400">Loading profile...</div>;
  }


  return (

    <div className="relative pt-2 min-h-screen bg-gray-100 dark:bg-[#191919] text-gray-900 dark:text-white transition-colors duration-300">
      {/* Close Button */}
      <button
        onClick={() => navigate(-1)}
        className="absolute top-0 right-0 z-[100] p-3 
             bg-white dark:bg-[#252525] 
             border border-slate-200 dark:border-white/10 
             rounded-full text-slate-500 dark:text-gray-400 
             hover:text-slate-950 dark:hover:text-white 
             shadow-xl transition-all active:scale-90"
      >
        <X size={20} />
      </button>

      {/* Main Content - 75% width */}
      <div className="mx-auto px-2 ">
        {/* Header Section */}
        <div className="w-full dark:border-white/10 dark:bg-[#191919] pb-4 pt-4">
          <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex flex-col">
              {/* Top Row: Name and Action Buttons */}
              <div className="flex items-center gap-5 flex-wrap">
                <h1 className="text-4xl font-black tracking-tight text-gray-900 dark:text-white italic uppercase leading-none">
                  {profileUser?.username || "John Developer"}
                </h1>

                {isOwnProfile ? (
                  <button
                    onClick={() => setEditOpen(true)}
                    className="bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-[#191919] px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all hover:shadow-[0_0_15px_rgba(0,0,0,0.1)] dark:hover:shadow-[0_0_15px_rgba(255,255,255,0.3)] active:scale-95"
                  >
                    Edit Profile
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <FollowButton userId={user?._id ?? ''} targetId={profileUser?._id ?? ''} />
                    <button
                      onClick={() => openChatWith(profileUser!._id)}
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest transition-all active:scale-95"
                    >
                      <MessageSquare size={16} strokeWidth={3} />
                      <span>Chat</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Bottom Row: Handle */}
              <p className="text-sm font-bold text-gray-500 dark:text-gray-400 mt-1.5 lowercase opacity-80">
                @{profileUser?.username?.replace(/\s+/g, '') || "johndeveloper"}
              </p>

              {editOpen && (
                <EditProfileModal
                  onClose={() => setEditOpen(false)}
                  onSaved={() => {
                    if (username) clearProfileCache(username);
                    cachedRef.current = null;
                    setEditOpen(false);
                  }}
                />
              )}
            </div>

            <div className="md:mr-20 lg:mr-8">
              <FollowersList userId={profileUser?._id} />
            </div>
          </div>
        </div>

        {/* Profile Hero Section */}
        <div className="max-w-5xl px-4">
          <div className="flex flex-col md:flex-row justify-between items-stretch gap-6">

            {/* LEFT SIDE: Profile Card Section */}
            <div className="flex-1 pt-0">
              <div className="relative overflow-hidden rounded-3xl bg-[#F9FAFB] dark:bg-[#191919] border border-gray-200 dark:border-white/10 shadow-2xl h-full min-h-[400px] flex flex-col">

                {/* 1. Banner Section */}
                <div className="relative h-32 md:h-48 shrink-0 overflow-hidden">
                  <img
                    src={profileUser?.banner || "https://fastly.picsum.photos/id/299/800/200.jpg?hmac=xMdRbjiNM_IogJDEgKIJ0GeCxZ8nwOGd5_Wf_ODZ94s"}
                    className="w-full h-full object-cover"
                    alt="Cover"
                  />
                  {/* Overlay gradient */}
                  <div
                    className="absolute inset-0 bg-gradient-to-b from-transparent via-black/5 to-white dark:to-[#191919]"
                  />
                </div>

                {/* 2. Info Overlay Section (50% Overlap) */}
                <div className="relative px-8 -mt-14 md:-mt-20 flex flex-col items-center text-center md:flex-row md:items-end md:text-left gap-6 z-10">
                  <div className="relative group shrink-0">
                    <img
                      src={profileUser?.avatar || "/default_avatar.png"}
                      className="relative w-28 h-28 md:w-40 md:h-40 rounded-full object-cover border-4 md:border-8 border-white dark:border-[#191919] shadow-2xl hover:scale-105 transition-transform duration-300 cursor-pointer bg-white dark:bg-[#191919]"
                      alt="Avatar"
                    />
                  </div>

                  {/* Profile Text */}
                  <div className="md:mb-4">
                    <p className="text-gray-500 dark:text-gray-400 font-medium text-xs md:text-sm leading-relaxed max-w-sm">
                      With an <span className="text-gray-900 dark:text-white font-bold">authoritative voice</span> and calm demeanor...
                    </p>
                  </div>
                </div>

                {/* Content Body */}
                <div className="p-8 flex-grow">
                  <div className="text-gray-500 dark:text-gray-500 text-sm">
                    {profileUser?.bio || "Additional profile content or bio details can go here."}
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT SIDE: Socials Card Section */}
            <div className="w-full md:w-40 shrink-0 pt-0">
              <div className="bg-white dark:bg-[#191919] p-6 rounded-3xl border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white shadow-2xl flex flex-col items-center h-full transition-colors duration-300">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500 mb-8">Socials</h3>

                <div className="flex flex-col gap-4 w-full">
                  {/* X (Twitter) */}
                  <a href={profileUser?.socials?.twitter} className="group relative flex items-center justify-center w-full h-12 
        /* Light Mode: Solid Grayish -> Darker Gray */
        bg-gray-100 hover:bg-gray-200 border-gray-200 
        /* Dark Mode: Translucent -> Light Gray */
        dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/5 dark:hover:border-white/20 
        rounded-2xl transition-all duration-300">
                    <svg className="w-5 h-5 fill-gray-900 dark:fill-white group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
                    </svg>
                    <div className="absolute right-[115%] opacity-0 group-hover:opacity-100 transition-all duration-300 bg-gray-900 dark:bg-white text-white dark:text-black text-[10px] font-bold py-1 px-3 rounded-md pointer-events-none uppercase tracking-tighter shadow-xl">
                      Twitter
                    </div>
                  </a>

                  {/* YouTube */}
                  <a href={profileUser?.socials?.youtube} className="group relative flex items-center justify-center w-full h-12 
        /* Light Mode: Red Tint -> Darker Red Tint */
        bg-red-50 hover:bg-red-100 border-red-100 
        /* Dark Mode: Translucent -> Darker */
        dark:bg-white/5 dark:hover:bg-red-500/10 dark:border-white/5 dark:hover:border-red-500/40 
        rounded-2xl transition-all duration-300">
                    <Youtube className="w-5 h-5 text-red-600 dark:text-gray-400 group-hover:text-red-700 dark:group-hover:text-red-500 group-hover:scale-110 transition-all" />
                    <div className="absolute right-[115%] opacity-0 group-hover:opacity-100 transition-all duration-300 bg-red-600 text-white text-[10px] font-bold py-1 px-3 rounded-md pointer-events-none uppercase tracking-tighter shadow-xl">
                      YouTube
                    </div>
                  </a>

                  {/* Instagram */}
                  <a href={profileUser?.socials?.instagram} className="group relative flex items-center justify-center w-full h-12 
        /* Light Mode: Pink Tint -> Darker Pink Tint */
        bg-pink-50 hover:bg-pink-100 border-pink-100 
        /* Dark Mode */
        dark:bg-white/5 dark:hover:bg-pink-500/10 dark:border-white/5 dark:hover:border-pink-500/40 
        rounded-2xl transition-all duration-300">
                    <Instagram className="w-5 h-5 text-pink-600 dark:text-gray-400 group-hover:text-pink-700 dark:group-hover:text-pink-500 group-hover:scale-110 transition-all" />
                    <div className="absolute right-[115%] opacity-0 group-hover:opacity-100 transition-all duration-300 bg-gradient-to-tr from-yellow-400 to-pink-600 text-white text-[10px] font-bold py-1 px-3 rounded-md pointer-events-none uppercase tracking-tighter shadow-xl">
                      Instagram
                    </div>
                  </a>

                  {/* Steam */}
                  <a href={profileUser?.socials?.steam} className="group relative flex items-center justify-center w-full h-12 
        /* Light Mode: Blue Tint -> Darker Blue Tint */
        bg-blue-50 hover:bg-blue-100 border-blue-100 
        /* Dark Mode */
        dark:bg-white/5 dark:hover:bg-blue-500/10 dark:border-white/5 dark:hover:border-blue-500/40 
        rounded-2xl transition-all duration-300">
                    <svg className="w-6 h-6 fill-blue-600 dark:fill-gray-400 group-hover:fill-blue-700 dark:group-hover:fill-blue-400 group-hover:scale-110 transition-all" viewBox="0 0 24 24">
                      <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.67c.527-.354 1.155-.519 1.777-.472l2.813-4.067V9.113c0-2.392 1.954-4.34 4.344-4.34 2.391 0 4.344 1.948 4.344 4.34 0 2.392-1.953 4.34-4.344 4.34-.14 0-.279-.01-.417-.027l-3.979 4.013c.032.19.047.385.047.583 0 1.952-1.595 3.54-3.556 3.54a3.53 3.53 0 0 1-3.21-2.03L.05 16.591C1.22 20.85 5.232 24 10 24c6.627 0 12-5.373 12-12S18.627 0 12 0h-.021z" />
                    </svg>
                    <div className="absolute right-[115%] opacity-0 group-hover:opacity-100 transition-all duration-300 bg-blue-600 text-white text-[10px] font-bold py-1 px-3 rounded-md pointer-events-none uppercase tracking-tighter shadow-xl">
                      Steam
                    </div>
                  </a>

                  {/* Discord */}
                  <a href={profileUser?.socials?.discord} className="group relative flex items-center justify-center w-full h-12 
        /* Light Mode: Discord Blue Tint -> Darker Tint */
        bg-[#5865F2]/10 hover:bg-[#5865F2]/20 border-[#5865F2]/20 
        /* Dark Mode */
        dark:bg-white/5 dark:hover:bg-[#5865F2]/10 dark:border-white/5 dark:hover:border-[#5865F2]/40 
        rounded-2xl transition-all duration-300">
                    <svg className="w-5 h-5 fill-[#5865F2] dark:fill-gray-400 group-hover:fill-[#4752c4] dark:group-hover:fill-[#5865F2] transition-all group-hover:scale-110" viewBox="0 0 24 24">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.086 2.157 2.419c0 1.334-.947 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.086 2.157 2.419c0 1.334-.946 2.419-2.157 2.419z" />
                    </svg>
                    <div className="absolute right-[115%] opacity-0 group-hover:opacity-100 transition-all duration-300 bg-[#5865F2] text-white text-[10px] font-bold py-1.5 px-3 rounded-lg pointer-events-none shadow-xl border border-white/10 uppercase tracking-tighter">
                      Discord
                    </div>
                  </a>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Two Component Cards Section */}
      <div className="max-w-6xl mx-auto px-6 mt-12 pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative">

          {/* MODEL POST → replace LEFT + RIGHT */}
          <>
            {/* LEFT COLUMN */}
            <div className="lg:col-span-7 flex flex-col w-full">
              {loadingPosts && (
                <div className="text-gray-400">Loading your posts...</div>
              )}

              {!loadingPosts && userPosts.length === 0 && (
                <div className="text-gray-400">
                  You haven’t uploaded any posts yet.
                </div>
              )}

              <div className="flex flex-col">
                {userPosts.map((post) => (
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

                {hasMorePosts && (
                  <div
                    ref={loadMoreRef}
                    className="h-10 flex items-center justify-center"
                  >
                    <span className="text-xs text-gray-400">
                      Loading more posts...
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN — ONLY FOR NON-MODEL POSTS */}
            <div className="lg:col-span-5 hidden lg:block">
              <div className="sticky top-4">
                {/* Match the background and border to your Hero/Socials cards */}
                <div className="bg-white dark:bg-[#191919] rounded-3xl p-8 w-full border border-gray-200 dark:border-white/10 shadow-2xl flex flex-col max-h-[calc(100vh-40px)]">
                  {/* USER ARTICLES SECTION */}
                  <div className="mb-10">
                    <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500 mb-4">
                      Articles by {profileUser?.username || "User"}
                    </h2>

                    {loadingArticles && (
                      <p className="text-gray-400 text-xs">Loading articles...</p>
                    )}

                    {!loadingArticles && userArticles.length === 0 && (
                      <p className="text-gray-500 text-xs">
                        No articles published yet.
                      </p>
                    )}

                    {!loadingArticles && userArticles.length > 0 && (
                      <div
                        className="flex gap-4 overflow-x-auto pb-3
                          [&::-webkit-scrollbar]:h-1
                          [&::-webkit-scrollbar-thumb]:bg-gray-200 dark:[&::-webkit-scrollbar-thumb]:bg-white/10
                          [&::-webkit-scrollbar-thumb]:rounded-full
                          [&::-webkit-scrollbar-track]:bg-transparent"
                      >
                        {userArticles.map((article) => (
                          <div
                            key={article._id}
                            className="min-w-[220px] max-w-[220px] bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl overflow-hidden hover:bg-gray-100 dark:hover:bg-white/10 transition-all cursor-pointer shrink-0"
                          >
                            <div className="h-24 w-full overflow-hidden">
                              <img
                                src={article.hero_image_url || "https://picsum.photos/300/200"}
                                alt="article"
                                className="w-full h-full object-cover"
                              />
                            </div>

                            <div className="p-4">
                              <h3 className="text-sm font-bold text-gray-900 dark:text-white line-clamp-2">
                                {article.title}
                              </h3>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                                {article.subtitle || "No subtitle provided"}
                              </p>
                              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2">
                                {new Date(article.publishedAt).toDateString()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500 mb-8 text-center lg:text-left">
                    Support {profileUser?.username || "Author"}'s Causes
                  </h2>

                  <div className="overflow-y-auto pr-2 space-y-8 flex-grow
                    [&::-webkit-scrollbar]:w-1
                    [&::-webkit-scrollbar-thumb]:bg-gray-200 dark:[&::-webkit-scrollbar-thumb]:bg-white/10
                    [&::-webkit-scrollbar-thumb]:rounded-full
                    [&::-webkit-scrollbar-track]:bg-transparent">

                    {[
                      {
                        title: "Environmental Initiative",
                        desc: "Support the bee sanctuary and environmental conservation efforts.",
                        btn: "Donate Now",
                        btnClass: "bg-gray-900 dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200",
                      },
                      {
                        title: "Education Fund",
                        desc: "Contribute to scholarship programs for aspiring actors and filmmakers.",
                        btn: "Support Education",
                        btnClass: "bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10",
                      },
                      {
                        title: "Hurricane Relief",
                        desc: "Help rebuild communities affected by natural disasters.",
                        btn: "Emergency Relief Fund",
                        btnClass: "bg-red-600 hover:bg-red-700 text-white",
                      },
                      {
                        title: "Fan Club",
                        desc: "Join the official community for exclusive content and updates.",
                        btn: "Join – $9.99/month",
                        btnClass: "bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10",
                        divider: true,
                      },
                    ].map((item, idx) => (
                      <div
                        key={idx}
                        className={`pt-6 ${item.divider ? "border-t border-gray-200 dark:border-white/10" : ""}`}
                      >
                        <h3 className="text-sm font-black uppercase tracking-tight text-gray-900 dark:text-white mb-2 italic">
                          {item.title}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 leading-relaxed">
                          {item.desc}
                        </p>
                        <button className={`w-full py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${item.btnClass}`}>
                          {item.btn}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;