import React, { memo, useMemo, useEffect, useRef, useState } from 'react';
import { useLikes } from "../../hooks/useLikes";
import { useWishlist } from '../../hooks/useWishlist';
import PostHeader from "./PostHeader";
import PostInteractions from "./PostInteractions";
import CommentSection from "./CommentSection";
import "@google/model-viewer";
import type { ExePostProps } from "../../types/Post";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
const ExePost: React.FC<ExePostProps> = ({
  user,
  description,
  // gameUrl,
  onOpenDetails,
  createdAt,
  modelPost,
  detailed = false,
  comments = 0,
  _id,
  avatarUrl = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(false); // ✅ toggle comment section
  const postRef = useRef(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
  const { likesCount, isLiked, handleLike } = useLikes(_id, BACKEND_URL);
  const { isWishlisted, handleWishlist } = useWishlist(_id, BACKEND_URL);
  const navigate = useNavigate();
  const location = useLocation();
  let viewStartTime = useRef<number | null>(null);
  const modelUrl = modelPost?.assets?.[0]?.url;
  const price = modelPost?.price;
  // const handleGameStream = async () => {
  //   setLoading(true);
  //   setError(null);
  //   try {
  //     const response = await axios.post(`${BACKEND_URL}/api/gameRoutes/start_game`, {
  //       gameUrl,
  //     });

  //     if (response.status !== 200) {
  //       throw new Error(`Server error: ${response.statusText}`);
  //     }

  //     console.log("Game stream started:", response.data);
  //   } catch (err: any) {
  //     setError(err.message || "Unknown error");
  //   } finally {
  //     setLoading(false);
  //   }
  // };
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
  // Auto show comments in detail view 
  useEffect(() => {
    if (detailed) setShowComments(true);
  }, [detailed]);

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
    //   
    <article
      ref={postRef}
      onClick={(e) => {
        if (detailed) return;

        // prevent interaction clicks
        if ((e.target as HTMLElement).closest("button")) return;

        // 🔥 OPEN DETAILS IN HOME (NO ROUTING)
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
            price={price ?? 0}
            type='model_post'
          />

          {/* DESCRIPTION */}
          const [isExpanded, setIsExpanded] = useState(false);

          // ... inside your JSX

          {description && (
            <div className="mt-2 mb-4">
              <p
                className={`text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap overflow-hidden transition-all duration-300 ${!isExpanded ? "max-h-12" : "max-h-[1000px]"
                  }`}
              >
                {description}
              </p>

              {/* Only show button if description is long enough to need it */}
              {description.length > 100 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // Prevents opening post details when clicking the button
                    setIsExpanded(!isExpanded);
                  }}
                  className="text-sky-500 hover:text-sky-600 font-semibold text-sm mt-1 focus:outline-none"
                >
                  {isExpanded ? "Show less" : "Show more"}
                </button>
              )}
            </div>
          )}

          {/* 3D MODEL */}
          {modelUrl && (
            <div className="flex justify-center relative overflow-hidden w-full h-[400px] rounded-xl">
              {/* @ts-ignore */}
              <model-viewer
                src={modelUrl}
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                camera-controls
                auto-rotate
                exposure="1.2"
                environment-image="neutral"
                shadow-intensity="1"
                style={{ width: "600px", height: "400px" }}
              />

            </div>
          )}

          {/* Post Interactions */}
          <PostInteractions
            postId={_id}
            likes={likesCount}
            comments={comments}
            isLiked={isLiked}
            onLike={handleLike}
            isWishlisted={isWishlisted}
            onWishlist={handleWishlist}
            onCommentToggle={() => onOpenDetails?.()} // ✅ toggle
          />

          {/* Comment Section (shown only if showComments is true) */}
          {showComments && <CommentSection postId={_id} BACKEND_URL={BACKEND_URL} />}
        </div>

      </div>

    </article>
  );
};

export default ExePost;
