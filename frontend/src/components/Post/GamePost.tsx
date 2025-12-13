import React, { memo, useMemo, useEffect, useRef, useState } from 'react';
import PostHeader from './PostHeader';
import CommentSection from './CommentSection';
import { useLikes } from '../../hooks/useLikes';
import { useWishlist } from '../../hooks/useWishlist';
import { Link } from 'react-router-dom';
import PostInteractions from './PostInteractions';
import type { GamePostProps } from '../../types/Post'; // Assuming you have a type definition for PostProps



const GamePost: React.FC<GamePostProps> = ({
  user,
  description,
  gameUrl,
  createdAt,
  comments = 0,
  _id,
  avatarUrl = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
}) => {
  const timestamp = useMemo(() => new Date(createdAt).toLocaleString(), [createdAt]);
  const postRef = useRef(null);
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
  const [showComments, setShowComments] = useState(false); // ✅ toggle comment section
  const { likesCount, isLiked, handleLike } = useLikes(_id, BACKEND_URL);
  const { isWishlisted, handleWishlist } = useWishlist(_id, BACKEND_URL);
  let viewStartTime = useRef<number | null>(null);
  const handleStartGame = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/interactions/played-demo`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: _id })
      });
    } catch (err) {
      console.error("Failed to update view", err);
    }
  };
  // API: Start view session
  const startViewing = async () => {
    viewStartTime.current = Date.now();

    await fetch(`${BACKEND_URL}/api/interactions/playtime-start`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: _id })
    });
  };

  // API: End view session & send duration
  const stopViewing = async () => {
    if (!viewStartTime.current) return;

    const duration = Math.floor((Date.now() - viewStartTime.current) / 1000); // seconds
    viewStartTime.current = null;

    await fetch(`${BACKEND_URL}/api/interactions/playtime-end`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId: _id, duration })
    });
  };
  const markViewed = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/interactions/view`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: _id })
      });
    } catch (err) {
      console.error("Failed to update view", err);
    }
  };

  // Detect when post becomes visible
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          startViewing(); // start tracking
          markViewed();
        }
        else {
          stopViewing(); // stop tracking
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
      className="
    relative w-full 
    border border-gray-200 dark:border-gray-700
    bg-white dark:bg-black
    hover:bg-[#F7F9F9] dark:hover:bg-[#16181C]
    transition-colors duration-200
    cursor-pointer
  "
    >
      <div className="flex gap-3 p-4">

        {/* LEFT COLUMN — Avatar stays here */}
        <img
          src={avatarUrl}
          alt={user.username}
          className="h-10 w-10 rounded-full object-cover mt-1"
        />

        {/* RIGHT COLUMN — Header + content */}
        <div className="flex flex-col flex-1 min-w-0">


          {/* Username + Date + Menu + Price */}
          <PostHeader
            username={user.username}
            timestamp={timestamp}
          />

          {/* DESCRIPTION */}
          {description && (
            <p className="text-gray-800 dark:text-gray-200 mt-2 mb-4">
              {description}
            </p>
          )}

          {/* Game Preview */}
          <div className="relative overflow-hidden bg-gray-100 dark:bg-gray-700 h-[400px] rounded-xl">
            <div className="flex flex-col items-center justify-center h-full space-y-4">
              <Link to='/stream'><button
                onClick={handleStartGame}
                // disabled={!gameUrl}
                className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-all"
              >
                {/* {gameUrl ? 'Start Game' : 'Game Not Available'} */} Start Game
              </button></Link>
            </div>
          </div>
          {/* Post Interactions */}
          <PostInteractions
            likes={likesCount}
            comments={comments}
            isLiked={isLiked}
            onLike={handleLike}
            isWishlisted={isWishlisted}
            onWishlist={handleWishlist}
            onCommentToggle={() => setShowComments(!showComments)} // ✅ toggle
          />

          {/* Comment Section (shown only if showComments is true) */}
          {showComments && <CommentSection postId={_id} BACKEND_URL={BACKEND_URL} />}
        </div>

      </div>

    </article>
  );
};

export default GamePost;
