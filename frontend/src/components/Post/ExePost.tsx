import React, { memo, useMemo, useEffect, useRef, useState } from 'react';
import { useLikes } from "../../hooks/useLikes";
import { useWishlist } from '../../hooks/useWishlist';
import PostHeader from "./PostHeader";
import PostInteractions from "./PostInteractions";
import CommentSection from "./CommentSection";
import "@google/model-viewer";
import type { ExePostProps } from "../../types/Post";
import axios from "axios";

const ExePost: React.FC<ExePostProps> = ({
  user,
  description,
  gameUrl,
  createdAt,
  comments = 0,
  _id,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(false); // ✅ toggle comment section
  const postRef = useRef(null);
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
  const { likesCount, isLiked, handleLike } = useLikes(_id, BACKEND_URL);
  const { isWishlisted, handleWishlist } = useWishlist(_id, BACKEND_URL);
  let viewStartTime = useRef<number | null>(null);
  const handleGameStream = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.post(`${BACKEND_URL}/api/gameRoutes/start_game`, {
        gameUrl,
      });

      if (response.status !== 200) {
        throw new Error(`Server error: ${response.statusText}`);
      }

      console.log("Game stream started:", response.data);
    } catch (err: any) {
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };
  const getRelativeTime = (date: string | Date) => {
    const now = new Date();
    const created = new Date(date);
    const diffMs = now.getTime() - created.getTime();

    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    // 🔥 If within the same day (< 24 hours)
    if (seconds < 60) return `${seconds}s`;
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;

    // 🔥 If older than a day → show Month + Day like "Nov 31"
    const options: Intl.DateTimeFormatOptions = {
      month: "short",
      day: "numeric"
    };

    return created.toLocaleDateString("en-US", options);
  };

  const timestamp = useMemo(() => getRelativeTime(createdAt), [createdAt]);
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
      className="relative bg-white w-full border border-gray-200
  dark:border-gray-600 dark:bg-black shadow-sm 
  overflow-hidden transition-all duration-300 hover:shadow-md"
    >


      <div ref={postRef} className="p-4">
        <PostHeader username={user.username} timestamp={timestamp} />

        {description && (
          <div className="mb-4">
            <p className="text-gray-800 dark:text-gray-200">{description}</p>
          </div>
        )}
        {/* 3D model division */}
        <div className="flex justify-center relative overflow-hidden w-full h-[400px] rounded-xl">
          <div className="w-full h-full flex items-center justify-center">
            {/* @ts-ignore */}
            <model-viewer
              src="/models/free_1972_datsun_240k_gt.glb"
              alt="3D model"
              auto-rotate
              camera-controls
              style={{ width: "600px", height: "400px" }}
            />
          </div>
        </div>
        {/* Game preview / play button */}
        {/* <div className="flex justify-center relative overflow-hidden w-full bg-gray-100 dark:bg-gray-700 h-[400px] rounded-xl">
          <div className="flex flex-col items-center justify-center h-full space-y-4">
            <button
              onClick={handleGameStream}
              disabled={loading}
              className="px-6 py-3 bg-black text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-all"
            >
              {loading ? "Loading..." : "Play Game"}
            </button>
            {error && <p className="text-red-500 mt-2">{error}</p>}
          </div>
        </div> */}

        {/* <div className="w-[40%] p-4 pl-6 flex flex-col justify-center">
          <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-200">Game Details</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-2">
            <span className="font-semibold">URL:</span> {gameUrl}
          </p>
        </div> */}
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
    </article>
  );
};

export default ExePost;
