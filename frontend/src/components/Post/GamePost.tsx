import React, { useMemo, useEffect, useRef, useState } from 'react';
import { Play, Gamepad2, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { useQueue } from '../../context/QueueContext';
import { useUI } from '../../context/UIContext';
import { useLikes } from '../../hooks/useLikes';
import { useWishlist } from '../../hooks/useWishlist';
import PostHeader from './PostHeader';
import PostInteractions from './PostInteractions';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

interface GamePostProps {
  user: any;
  description: string;
  createdAt: string;
  commentsCount: number;
  likesCount: number;
  isLiked: boolean;
  isWishlisted: boolean;
  onOpenDetails: () => void;
  disableInteractions: boolean;
  _id: string;
  gamePost: any;
}

const GamePost: React.FC<GamePostProps> = ({
  user,
  description,
  createdAt,
  commentsCount,
  likesCount,
  isLiked,
  isWishlisted,
  onOpenDetails,
  disableInteractions,
  _id,
  gamePost,
}) => {
  const postRef = useRef(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  
  
  let viewStartTime = useRef<number | null>(null);

  const { likesCount: localLikesCount, isLiked: localIsLiked, handleLike } = useLikes(_id, BACKEND_URL);
  const { isWishlisted: localIsWishlisted, handleWishlist } = useWishlist(_id, BACKEND_URL);
  const { setIsAdPlaying } = useUI();
  
  const { queue, startSession } = useQueue();



  // ✅ Check if ANY session exists (prevent starting new ones)
  const hasActiveSession = queue.sessionId !== null && ['waiting', 'allocation_ready', 'starting', 'running'].includes(queue.status);

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

  const timestamp = useMemo(() => getRelativeTime(createdAt), [createdAt]);

  const handleStartGame = async () => {
    if (isStarting || hasActiveSession) return;
    setIsStarting(true);

    try {
      const sessionId = await startSession(_id);
      if (sessionId) {
        setIsAdPlaying(true);
      }
    } catch (err) {
      console.error("Failed to start game:", err);
      setIsStarting(false);
    }
  };

  // Analytics tracking
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

  useEffect(() => {
  if (!queue.sessionId) {
    setIsStarting(false);
  }
}, [queue.sessionId]);

  return (
    <>
      {/* GAME POST CARD */}
      <article
        ref={postRef}
        onClick={() => {
          onOpenDetails?.();
        }}
        className="relative w-full border border-gray-200 dark:border-gray-700 border-l-0 border-r-0 sm:border-l sm:border-r bg-white dark:bg-[#191919] hover:bg-[#F7F9F9] dark:hover:bg-[#16181C] cursor-pointer"
      >
        <div className="flex gap-3 p-4">
          {/* Avatar */}
          <img
            src={user.avatar || "/default_avatar.png"}
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
                    className="text-sky-500 hover:text-sky-600 font-semibold text-sm mt-1"
                  >
                    {isExpanded ? "Show less" : "Show more"}
                  </button>
                )}
              </div>
            )}

            {/* GAME CARD */}
            {gamePost && (
              <div className="group relative rounded-2xl overflow-hidden border border-gray-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 mb-4">
                <div className="absolute inset-0 bg-gradient-to-br from-sky-500/10 via-transparent to-purple-500/10 opacity-50" />

                <div className="relative p-8 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 bg-[#F9FAFB] dark:bg-[#191919] rounded-2xl shadow-xl flex items-center justify-center mb-4 border border-gray-100 dark:border-zinc-800 group-hover:scale-110 transition-transform duration-300">
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

                  {/* Status indicator while waiting */}
                  {hasActiveSession && queue.status === 'waiting' && (
                    <div className="mt-4 w-full bg-blue-500/10 border border-blue-500/30 rounded-lg p-2">
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium flex items-center gap-2 justify-center">
                        <Loader2 size={14} className="animate-spin" />
                        Waiting in queue... 
                      </p>
                    </div>
                  )}

                  {/* Play Button - ✅ Disabled if any session exists */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartGame();
                    }}
                    disabled={isStarting || hasActiveSession}
                    title={hasActiveSession ? "Complete or cancel current session first" : ""}
                    className="mt-4 w-full flex items-center justify-center gap-2 py-3.5
                      bg-sky-500 hover:bg-sky-600 text-white font-black rounded-xl
                      transition-all shadow-lg shadow-sky-500/20
                      active:scale-[0.98]
                      disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Play size={18} fill="currentColor" />
                    {isStarting ? "STARTING..." : hasActiveSession ? "BUSY" : "PLAY NOW"}
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
                  likes={localLikesCount}
                  comments={commentsCount ?? 0}
                  isLiked={localIsLiked}
                  isWishlisted={localIsWishlisted}
                  onLike={handleLike}
                  onWishlist={handleWishlist}
                  onCommentToggle={() => onOpenDetails?.()}
                />
              </div>
            )}
          </div>
        </div>
      </article>
    </>
  );
};


export default GamePost;