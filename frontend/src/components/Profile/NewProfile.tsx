// src/pages/ProfilePage.tsx
import React from "react";
import { MessageSquare, MapPin, Link as LinkIcon, Cake, Briefcase } from "lucide-react";
import FollowButton from "../FollowButton";
import type { ArticleProps } from "../../types/Article";
import FollowersList from "../FollowersList";
import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useScrollRestoration } from "../../hooks/useScrollRestoration";
import { saveProfileCache, getProfileCache, clearProfileCache } from "../../utils/profileCache";
import type { ProfileUser } from "../../utils/profileCache";
import Post from "../Post";
import { useChat } from "../../context/ChatContext";
import { usePosts } from "../../context/PostContext";
import EditProfileModal from "./EditProfileModal";
import type { PostProps } from "../../types/Post";
import { useUser } from "../../context/user";
import { trackEvent } from "../../utils/analytics";
import api from "../../utils/api";
import ProfileNotFound from "../../Pages/ErrorHandling/ProfileNotFound";
import Logo from "../../assets/Icon.svg?react";

// Shared glass card style used across all panels
const glassCard =
  "bg-transparent backdrop-blur-md border border-white/10 rounded-3xl";

const ProfilePage: React.FC = () => {
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
  const { username } = useParams<{ username: string }>();
  const { user, refreshUser } = useUser();
  const { addPosts } = usePosts();
  const navigate = useNavigate();
  const { openChatWith } = useChat();
  const location = useLocation();
  const cachedRef = useRef(username ? getProfileCache(username) : null);
  const cached = cachedRef.current;
  const [profileUser, setProfileUser] = useState<ProfileUser | null>(cached?.profileUser ?? null);
  const [profileNotFound, setProfileNotFound] = useState(false);
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
  const activeFetchIdRef = useRef<string | null>(null);
  const activeArticleFetchIdRef = useRef<string | null>(null);
  const isOwnProfile = user?._id === profileUser?._id;

  const contentReady = !loadingProfile && userPosts.length > 0;
  const savedScrollY = cached?.scrollY ?? 0;
  useScrollRestoration(`profile_${username}`, savedScrollY, contentReady);
  const showRigzerLogo = isOwnProfile
  ? user?.isRigzer
  : profileUser?.isRigzer;

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

  // ── Fetch profile ────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchProfile = async () => {
      if (!username) return;
      try {
        const res = await api.get(`/api/users/username/${username}`);
        if (usernameRef.current !== username) return;
        setProfileUser(res.data);
      } catch (err: any) {
        if (err?.response?.status === 404) {
          setProfileNotFound(true);
        }
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
      const res = await api.get(`/api/posts/user_posts/${fetchId}`, {
        params: { cursor: cursorParam, limit: 10 },
      });
      addPosts(res.data.posts);
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

  // ── Fetch posts on profile load ───────────────────────────────────────────
  useEffect(() => {
    if (!profileUser?._id) return;
    trackEvent({
      eventType: "profile_page_view",
      targetType: "user",
      targetId: profileUser._id,
    });
    if (cachedRef.current?.posts?.length) return;
    fetchPosts(null);
  }, [profileUser?._id]);

  // ── Fetch articles on profile load ───────────────────────────────────────
  useEffect(() => {
    if (!profileUser?._id) return;
    if (cachedRef.current?.articles?.length) return;

    const fetchId = profileUser._id;
    activeArticleFetchIdRef.current = fetchId;

    const fetchArticles = async () => {
      try {
        const res = await api.get(`/api/articles/published/user/${fetchId}`);
        if (activeArticleFetchIdRef.current !== fetchId) return;
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
          fetchPosts(cursor).finally(() => {
            fetchingRef.current = false;
          });
        }
      },
      { root: null, rootMargin: "600px", threshold: 0 }
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [cursor, hasMorePosts, loadingPosts, profileUser?._id]);

  if (loadingProfile && !profileUser) {
    return <div className="p-10 text-white/50">Loading profile...</div>;
  }

  if (profileNotFound) {
    return <ProfileNotFound />;
  }

  return (
    <div className="relative min-h-screen text-white">

      {/* Max-width wrapper */}
      <div className="max-w-6xl">
        {/* ── Header: Username + Actions + Followers ── */}
        <div className="w-full pb-6 pt-2">
          <div className="flex justify-between items-start gap-6">

            {/* Left Side: Name, Buttons, and Handle */}
            {/* min-w-0 allows the container to shrink and wrap text properly */}
            <div className="flex-1 min-w-0 flex flex-col">

              {/* Name & Buttons Container (Strict Inline Text Flow) */}
              {/* Added leading-[1.3] so the tall buttons don't overlap lines */}
              <div className="text-4xl font-black tracking-tight text-white italic uppercase leading-[1.3]">

                {/* 1. Using a span ensures it wraps perfectly as raw text */}
                <span className="align-middle mr-4">
                  {profileUser?.displayName ?? profileUser?.username}
                </span>

                {/* 2. Action buttons wrapped in a span so they attach to the end of the text like a word */}
                {isOwnProfile ? (
                  <span className="inline-flex align-middle not-italic mb-1">
                    <button
                      onClick={() => setEditOpen(true)}
                      className="bg-white/10 hover:bg-white/20 border border-white/15 text-white px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest backdrop-blur-sm transition-all hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] active:scale-95"
                    >
                      Edit Profile
                    </button>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2 align-middle not-italic mb-1">
                    <FollowButton
                      targetId={profileUser ? profileUser._id : ""}
                      initialFollowing={profileUser?.isFollowing ?? false}
                    />
                    <button
                      onClick={() =>
                        openChatWith({
                          id: profileUser!._id,
                          name: profileUser!.username,
                          avatar: profileUser!.avatar ?? "./default-avatar.png",
                        })
                      }
                      className="inline-flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-600 text-white px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest backdrop-blur-sm transition-all active:scale-95"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="white"
                        xmlns="http://www.w3.org/2000/svg"
                        className="group-hover:animate-pulse"
                      >
                        <path d="M20 4H4C2.9 4 2.01 4.9 2.01 6L2 18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4ZM20 8L12 13L4 8V6L12 11L20 6V8Z" />
                      </svg>
                    </button>
                  </span>
                )}
              </div>

<p
  className="flex items-center gap-1.5 text-sm font-bold text-white/40 lowercase"
>
  <span>@{profileUser?.username?.replace(/\s+/g, "")}</span>

  {showRigzerLogo && (
    <img
      src="/Logo.png"
      alt="Rigzer"
      className="w-4 h-4 shrink-0"
    />
  )}
</p>
                

              {editOpen && (
                <EditProfileModal
                  onClose={() => setEditOpen(false)}
                  onSaved={(updatedProfile) => {
                    if (username) clearProfileCache(username);
                    cachedRef.current = null;

                    setProfileUser((prev) => {
                      if (!prev) return prev;

                      return {
                        ...prev,
                        ...updatedProfile,
                      };
                    });

                    refreshUser();
                    setEditOpen(false);
                  }}
                />
              )}
            </div>

            {/* Right Side: Followers/Following */}
            <div className="shrink-0 mt-2">
              <FollowersList userId={profileUser ? profileUser._id : ""} />
            </div>

          </div>
        </div>
        {/* ── Profile Hero ── */}
        <div className="max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-stretch gap-6 ">

            {/* LEFT: Profile Card */}
            <div className="flex-1 pt-0 bg-white/[0.03] rounded-3xl">
              <div className={`${glassCard} relative overflow-hidden flex flex-col`}>

                {/* Banner */}
                <div className="relative h-32 md:h-40 shrink-0 overflow-hidden rounded-t-3xl">
                  <img
                    src={
                      profileUser?.banner ||
                      "/Rigzer_Banner.jpeg"
                    }
                    className="w-full h-full object-cover"
                    alt="Cover"
                  />
                  {/* Fade into glass below */}
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/40" />
                </div>

                {/* Avatar + bio overlap */}
                {/* Increased conditional padding to pb-16 md:pb-20 for better breathing room */}
                <div
                  className={`relative px-8 -mt-14 md:-mt-20 flex flex-col items-center text-center md:flex-row md:items-start md:text-left gap-6 z-10 ${!(profileUser?.location || profileUser?.website || profileUser?.jobTitle) ? 'pb-16 md:pb-20' : ''
                    }`}
                >
                  <div className="relative group shrink-0">
                    <img
                      src={profileUser?.avatar || "/default_avatar.png"}
                      className="relative w-24 h-24 md:w-36 md:h-36 rounded-full object-cover p-2 shadow-2xl hover:scale-105 transition-transform duration-300 cursor-pointer"
                      alt="Avatar"
                    />
                  </div>

                  {/* Bio body */}
                  <div className="md:pt-24 max-w-xl flex flex-col items-center md:items-start md:ml-6">
                    <p className="text-white font-medium text-sm leading-relaxed break-words whitespace-pre-line">
                      {profileUser?.bio
                        ? profileUser.bio
                        : ""
                      }
                    </p>
                  </div>
                </div>

                {/* Additional metadata info */}
                {(profileUser?.location || profileUser?.website || profileUser?.jobTitle) && (
                  <div className="px-8 pb-8 flex flex-col gap-3 text-sm text-white/50 font-medium mt-2">

                    {/* Job Title */}
                    {profileUser?.jobTitle && (
                      <div className="flex items-center gap-2.5">
                        <Briefcase size={16} className="text-white/40 shrink-0" />
                        <span>{profileUser.jobTitle}</span>
                      </div>
                    )}

                    {/* Location */}
                    {profileUser?.location && (
                      <div className="flex items-center gap-2.5">
                        <MapPin size={16} className="text-white/40 shrink-0" />
                        <span>{profileUser.location}</span>
                      </div>
                    )}

                    {/* Website */}
                    {profileUser?.website && (
                      <div className="flex items-center gap-2.5">
                        <LinkIcon size={16} className="text-white/40 shrink-0" />
                        <a
                          href={profileUser.website.startsWith('http') ? profileUser.website : `https://${profileUser.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[rgb(98,212,174)] font-semibold hover:underline transition-all"
                        >
                          {profileUser.website.replace(/(^\w+:|^)\/\//, '')}
                        </a>
                      </div>
                    )}

                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      <div className="max-w-7xl mt-6 pb-112">
        <div className="min-w-0 flex flex-col">
          {loadingPosts && (
            <div className="text-white/40 text-sm">Loading your posts...</div>
          )}

          {!loadingPosts && userPosts.length === 0 && (
            <div className="text-white/40 text-sm">
              No posts to see here
            </div>
          )}

          <div className="flex flex-col">
            {userPosts.map((post) => (
              <Post
                key={post._id}
                {...post}
                viewSource="profile"
                onDeleteSuccess={(postId) => {
                  setUserPosts((prev) => prev.filter((p) => p._id !== postId));
                }}
                onOpenDetails={() => {
                  trackEvent({
                    eventType: "content_view",
                    targetType: post.type,
                    targetId: post._id,
                    metadata: {
                      source: "profile",
                      profileOwnerId: profileUser?._id,
                    },
                  });
                  navigate(`/post/${post._id}`, {
                    state: {
                      post,
                      from: location,
                    },
                  });
                }}
              />
            ))}

            {hasMorePosts && (
              <div ref={loadMoreRef} className="h-10 flex items-center justify-center">
                <span className="text-xs text-white/30">Loading more posts...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;