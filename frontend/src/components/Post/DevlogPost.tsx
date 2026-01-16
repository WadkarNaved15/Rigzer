import React, { memo, useMemo, useEffect, useRef,useState } from "react";
import { useNavigate } from "react-router-dom";
import PostHeader from "./PostHeader";
import PostInteractions from "./PostInteractions";
import { useLikes } from "../../hooks/useLikes";
import { useWishlist } from "../../hooks/useWishlist";
import type { DevlogPostProps } from "../../types/Post";
import { FileText } from "lucide-react";

const DevlogPost: React.FC<DevlogPostProps> = ({
  _id,
  user,
  devlogRef,
  devlogMeta,
  description,
  createdAt,
  onOpenDetails,
  disableInteractions,
  comments = 0,
  avatarUrl = "https://images.unsplash.com/photo-1494790108377-be9c29b29330",
}) => {
  const postRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  console.log("props received", devlogMeta);
  console.log("props received for devlogRef", devlogRef);
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

  const { likesCount, isLiked, handleLike } = useLikes(_id, BACKEND_URL);
  const [isExpanded, setIsExpanded] = useState(false);
  const { isWishlisted, handleWishlist } = useWishlist(_id, BACKEND_URL);
  const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL || "http://localhost:5173";
  /* -------------------- TIME FORMAT -------------------- */
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

  /* -------------------- VIEW TRACKING -------------------- */
  useEffect(() => {
    const observer = new IntersectionObserver(
      async (entries) => {
        if (entries[0].isIntersecting) {
          await fetch(`${BACKEND_URL}/api/interactions/view`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ postId: _id }),
          });
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );

    if (postRef.current) observer.observe(postRef.current);
    return () => observer.disconnect();
  }, [_id]);

  return (
    <article
      ref={postRef}
      onClick={() => onOpenDetails?.()}
      className="
        relative w-full 
        border border-gray-200 dark:border-gray-700
        bg-white dark:bg-[#191919]
        hover:bg-[#F7F9F9] dark:hover:bg-[#16181C]
        transition-colors duration-200
        cursor-pointer
      "
    >
      <div className="flex gap-3 px-4 py-3">
        {/* AVATAR */}
        <img
          src={avatarUrl}
          alt={user.username}
          className="h-10 w-10 rounded-full object-cover"
        />

        {/* CONTENT */}
        <div className="flex flex-col flex-1 min-w-0">
          <PostHeader
            username={user.username}
            timestamp={timestamp}
            price={0}
            type="devlog_post"
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

          {/* -------------------- DEVLOG PREVIEW -------------------- */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/devlogviewer/${devlogRef}`);
            }}
            className="
    mt-3
    w-full
    h-[320px]
    rounded-2xl
    overflow-hidden
    border border-gray-200 dark:border-gray-700
    bg-black
    flex items-center justify-center
    text-white
    relative
  "
          >
            {devlogMeta?.thumbnail ? (
              <img
                src={devlogMeta.thumbnail}
                alt={devlogMeta.title || "Devlog thumbnail"}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex items-center gap-3">
                <FileText className="w-10 h-10 opacity-80" />
                <span className="text-lg font-medium">Read Devlog</span>
              </div>
            )}

            {/* Overlay */}
            <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-lg font-semibold">Read Devlog</span>
            </div>
          </div>


          {/* -------------------- INTERACTIONS -------------------- */}
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
        </div>
      </div>
    </article>
  );
};

export default memo(DevlogPost);
