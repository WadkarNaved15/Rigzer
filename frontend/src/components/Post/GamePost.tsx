import React, { memo, useMemo, useEffect, useRef, useState } from 'react';
import PostHeader from './PostHeader';
import CommentSection from './CommentSection';
import { useLikes } from '../../hooks/useLikes';
import { useWishlist } from '../../hooks/useWishlist';
import { Link } from 'react-router-dom';
import PostInteractions from './PostInteractions';
import { Play, Gamepad2, Sparkles } from 'lucide-react';
import type { GamePostProps } from '../../types/Post';

const GamePost: React.FC<GamePostProps> = ({
  user,
  description,
  createdAt,
  comments = 0,
  _id,
  gamePost, 
  avatarUrl = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
}) => {
  const timestamp = useMemo(() => new Date(createdAt).toLocaleString(), [createdAt]);
  const postRef = useRef(null);
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
  const [showComments, setShowComments] = useState(false);
  const { likesCount, isLiked, handleLike } = useLikes(_id, BACKEND_URL);
  const { isWishlisted, handleWishlist } = useWishlist(_id, BACKEND_URL);
  let viewStartTime = useRef<number | null>(null);

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

  const handleStartGame = async () => {
    fetch(`${BACKEND_URL}/api/interactions/played-demo`, {
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

  return (
    <article
      ref={postRef}
      className="relative w-full border border-gray-200 dark:border-zinc-800 bg-white dark:bg-black hover:bg-gray-50/50 dark:hover:bg-zinc-900/20 transition-colors duration-200"
    >
      <div className="flex gap-3 p-4">
        {/* User Avatar */}
        <img src={avatarUrl} alt={user.username} className="h-10 w-10 rounded-full object-cover mt-1" />

        <div className="flex flex-col flex-1 min-w-0">
          <PostHeader
            type='game_post'
            username={user.username}
            timestamp={timestamp}
            price={gamePost?.price || 0}
          />

          {description && (
            <p className="text-gray-800 dark:text-gray-200 mt-2 mb-4 leading-relaxed whitespace-pre-wrap">
              {description}
            </p>
          )}

          {/* SIMPLIFIED GAME CARD - Focus on Instant Play */}
          {gamePost && (
            <div className="group relative rounded-2xl overflow-hidden border border-gray-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 mb-4 transition-all hover:border-sky-500/50">
              
              {/* Visual Background Decor */}
              <div className="absolute inset-0 bg-gradient-to-br from-sky-500/10 via-transparent to-purple-500/10 opacity-50" />
              
              <div className="relative p-8 flex flex-col items-center justify-center text-center">
                {/* Game Branding */}
                <div className="w-16 h-16 bg-white dark:bg-black rounded-2xl shadow-xl flex items-center justify-center mb-4 border border-gray-100 dark:border-zinc-800 group-hover:scale-110 transition-transform duration-300">
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

                {/* Call to Action */}
                <Link to='/stream' className="mt-8 w-full max-w-xs">
                  <button
                    onClick={handleStartGame}
                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-sky-500 hover:bg-sky-600 text-white font-black rounded-xl transition-all shadow-lg shadow-sky-500/20 active:scale-[0.98]"
                  >
                    <Play size={18} fill="currentColor" />
                    PLAY NOW
                  </button>
                </Link>

                <p className="text-[10px] text-gray-500 dark:text-zinc-500 mt-4 font-medium italic">
                  No download required • Powered by our Cloud Instances
                </p>
              </div>
            </div>
          )}

          <PostInteractions
            likes={likesCount}
            comments={comments}
            isLiked={isLiked}
            onLike={handleLike}
            isWishlisted={isWishlisted}
            onWishlist={handleWishlist}
            onCommentToggle={() => setShowComments(!showComments)}
          />

          {showComments && <CommentSection postId={_id} BACKEND_URL={BACKEND_URL} />}
        </div>
      </div>
    </article>
  );
};

export default GamePost;