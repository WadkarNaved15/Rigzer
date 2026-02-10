import React, { memo, useMemo, useEffect, useRef, useState } from 'react';
import PostHeader from './PostHeader';
import CommentSection from './CommentSection';
import { useLikes } from '../../hooks/useLikes';
import { useWishlist } from '../../hooks/useWishlist';
import { Link } from 'react-router-dom';
import PostInteractions from './PostInteractions';
import { Play, Gamepad2, Sparkles } from 'lucide-react';
import type { GamePostProps } from '../../types/Post';
import { useUI } from '../../context/UIContext';
import AdWithStatus from '../Home/PlayGame';

const GamePost: React.FC<GamePostProps> = ({
  user,
  description,
  createdAt,
  comments = 0,
  onOpenDetails,
  disableInteractions,
  _id,
  gamePost,
  avatarUrl = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
}) => {
  const postRef = useRef(null);
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
  const [showComments, setShowComments] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const { likesCount, isLiked, handleLike } = useLikes(_id, BACKEND_URL);
  const { isWishlisted, handleWishlist } = useWishlist(_id, BACKEND_URL);
  let viewStartTime = useRef<number | null>(null);
  
  // Session state management
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showAdOverlay, setShowAdOverlay] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const { setIsAdPlaying } = useUI();

  /* ---------------- Analytics Logic ---------------- */
  const startViewing = async () => {
    viewStartTime.current = Date.now();
    fetch(`${BACKEND_URL}/api/interactions/playtime-start`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: _id })
    }).catch(() => {});
  };

  const stopViewing = async () => {
    if (!viewStartTime.current) return;
    const duration = Math.floor((Date.now() - viewStartTime.current) / 1000);
    viewStartTime.current = null;
    fetch(`${BACKEND_URL}/api/interactions/playtime-end`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: _id, duration })
    }).catch(() => {});
  };

  const markViewed = async () => {
    fetch(`${BACKEND_URL}/api/interactions/view`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: _id })
    }).catch(() => {});
  };

  const getRelativeTime = (date: string | Date) => {
    const now = new Date();
    const created = new Date(date);
    const diffMs = now.getTime() - created.getTime();

    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) return `${seconds}s`;
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;

    return created.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const timestamp = useMemo(
    () => getRelativeTime(createdAt),
    [createdAt]
  );

const handleStartGame = async () => {
  if (isStarting) return; // 🔒 hard stop
  setIsStarting(true);

  try {
    setSessionError(null);

    const res = await fetch(`${BACKEND_URL}/api/sessions/start`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gamePostId: _id }),
    });

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error || "Failed to start session");
    }

    const data = await res.json();
    setSessionId(data.sessionId);
    setShowAdOverlay(true);
    setIsAdPlaying(true);
  } catch (err: any) {
    console.error("Failed to start game:", err);
    setSessionError(err.message || "Failed to start game. Please try again.");
    setIsStarting(false); // 🔓 allow retry on failure
  }
};


  const handleStreamReady = (sessionId: string) => {
    // Navigate to the stream page
    window.location.href = `/stream/${sessionId}`;
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          startViewing();
          markViewed();
        } else {
          stopViewing();
        }
      },
      { threshold: 0.5 }
    );
    if (postRef.current) observer.observe(postRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* =============================== 
          AD OVERLAY (Shows while session is starting)
      =============================== */}
      {showAdOverlay && sessionId && (
        <AdWithStatus
          sessionId={sessionId}
          onStreamReady={handleStreamReady}
        />
      )}

      {/* =============================== 
          POST CARD
      =============================== */}
      <article
        ref={postRef}
        onClick={(e) => {
          if (showAdOverlay) {
            e.stopPropagation();
            return;
          }
          onOpenDetails?.();
        }}
        className="
          relative w-full 
          border border-gray-200 dark:border-gray-700
          bg-white dark:bg-[#191919]
          hover:bg-[#F7F9F9] dark:hover:bg-[#16181C]
          transition-colors duration-200
          cursor-pointer
        "
      >
        <div className="flex gap-3 p-4">
          {/* User Avatar */}
          <img 
            src={avatarUrl} 
            alt={user.username} 
            className="h-10 w-10 rounded-full object-cover mt-1" 
          />

          <div className="flex flex-col flex-1 min-w-0">
            <PostHeader
              type='game_post'
              username={user.username}
              timestamp={timestamp}
              price={gamePost?.price || 0}
            />

            {description && (
              <div className="mt-2 mb-4">
                <p
                  className={`text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap transition-all ${
                    !isExpanded ? "line-clamp-2" : ""
                  }`}
                >
                  {description}
                </p>

                {description.length > 100 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsExpanded(!isExpanded);
                    }}
                    className="text-sky-500 hover:text-sky-600 font-semibold text-sm mt-1 focus:outline-none"
                  >
                    {isExpanded ? "Show less" : "Show more"}
                  </button>
                )}
              </div>
            )}

            {/* GAME CARD */}
            {gamePost && (
              <div className="group relative rounded-2xl overflow-hidden border border-gray-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 mb-4 transition-all hover:border-sky-500/50">
                <div className="absolute inset-0 bg-gradient-to-br from-sky-500/10 via-transparent to-purple-500/10 opacity-50" />

                <div className="relative p-8 flex flex-col items-center justify-center text-center">
                  {/* Game Icon */}
                  <div className="w-16 h-16 bg-white dark:bg-[#191919] rounded-2xl shadow-xl flex items-center justify-center mb-4 border border-gray-100 dark:border-zinc-800 group-hover:scale-110 transition-transform duration-300">
                    <Gamepad2 className="text-sky-500 w-8 h-8" />
                  </div>

                  <h3 className="text-2xl font-black text-black dark:text-white tracking-tight">
                    {gamePost.gameName}
                  </h3>

                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-200 dark:bg-zinc-800 px-2 py-0.5 rounded">
                      v{gamePost.version}
                    </span>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-sky-500 uppercase tracking-widest">
                      <Sparkles size={10} />
                      Instant Stream
                    </div>
                  </div>

                  {/* Error Message */}
                  {sessionError && (
                    <div className="mt-3 w-full bg-red-500/10 border border-red-500/30 rounded-lg p-2">
                      <p className="text-xs text-red-500 font-medium">{sessionError}</p>
                    </div>
                  )}

                  {/* Play Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartGame();
                    }}
                    disabled={isStarting}
                    className="mt-4 w-full flex items-center justify-center gap-2 py-3.5
                      bg-sky-500 hover:bg-sky-600 text-white font-black rounded-xl
                      transition-all shadow-lg shadow-sky-500/20
                      active:scale-[0.98]
                      disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Play size={18} fill="currentColor" />
                    {isStarting ? "STARTING..." : "PLAY NOW"}
                  </button>


                  <p className="text-[10px] text-gray-500 dark:text-zinc-500 mt-4 font-medium italic">
                    No download required • Powered by Cloud Instances
                  </p>
                </div>
              </div>
            )}

            {!disableInteractions && (
              <div onClick={(e) => e.stopPropagation()}>
                <PostInteractions
                  postId={_id}
                  likes={likesCount}
                  comments={comments}
                  isLiked={isLiked}
                  isWishlisted={isWishlisted}
                  onLike={handleLike}
                  onWishlist={handleWishlist}
                  onCommentToggle={() => onOpenDetails?.()}
                />
              </div>
            )}

            {showComments && <CommentSection postId={_id} BACKEND_URL={BACKEND_URL} />}
          </div>
        </div>
      </article>
    </>
  );
};

export default GamePost;