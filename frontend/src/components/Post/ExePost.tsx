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
  likesCount,
  isLiked,
  isWishlisted,
  // gameUrl,
  onOpenDetails,
  createdAt,
  modelPost,
  detailed = false,
  commentsCount,
  _id,
  avatarUrl = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(false); // ✅ toggle comment section
  const postRef = useRef(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [localCommentsCount, setLocalCommentsCount] = useState<number>(commentsCount ?? 0);
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
  const {likesCount: localLikesCount,isLiked: localIsLiked,handleLike} = useLikes(_id,BACKEND_URL);
   const {
    isWishlisted: localIsWishlisted,
    handleWishlist
  } = useWishlist(_id, BACKEND_URL);
  const navigate = useNavigate();
  const location = useLocation();
  let viewStartTime = useRef<number | null>(null);
  const asset = modelPost?.assets?.[0];

const modelUrl =
  asset?.optimization?.status === "completed"
    ? asset.optimizedUrl
    : asset?.originalUrl;
  const price = modelPost?.price;
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

  // Auto show comments in detail view 
  useEffect(() => {
    if (detailed) setShowComments(true);
  }, [detailed]);

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
    bg-[#F9FAFB] dark:bg-[#191919]
    hover:bg-[#F7F9F9] dark:hover:bg-[#16181C]
    transition-colors duration-200
    cursor-pointer
  "
    >

      <div className="flex gap-3 p-4">

        {/* LEFT COLUMN — Avatar stays here */}
        <img
          src={user.avatar || "/default_avatar.png"}
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

          {description && (
            <div className="mt-2 mb-4">
              <p
                className={`text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap transition-all ${!isExpanded ? "line-clamp-2" : ""
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
                autoplay
                animation-controls
                animation-name="*"
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
            likes={localLikesCount}
            comments={commentsCount ?? 0}
            isLiked={localIsLiked}
            onLike={handleLike}
            isWishlisted={localIsWishlisted}
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
