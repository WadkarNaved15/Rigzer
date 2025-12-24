import React, { memo, useMemo, useEffect, useRef, useState } from "react";
import PostHeader from "./PostHeader";
import PostInteractions from "./PostInteractions";
import CommentSection from "./CommentSection";
import { useLikes } from "../../hooks/useLikes";
import { useWishlist } from "../../hooks/useWishlist";
import type { NormalPostProps } from "../../types/Post";

const NormalPost: React.FC<NormalPostProps> = ({
  _id,
  user,
  description,
  normalPost,
  createdAt,
  comments = 0,
  avatarUrl = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80",
}) => {
  const [showComments, setShowComments] = useState(false);
  const postRef = useRef<HTMLDivElement>(null);


  const BACKEND_URL =
    import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

  const { likesCount, isLiked, handleLike } = useLikes(_id, BACKEND_URL);
  const { isWishlisted, handleWishlist } = useWishlist(_id, BACKEND_URL);

  const asset = normalPost?.assets?.[0];
  const isVideo = asset?.type === "video";
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
  // View tracking
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
      className="
        relative w-full 
        border border-gray-200 dark:border-gray-700
        bg-white dark:bg-black
        hover:bg-[#F7F9F9] dark:hover:bg-[#16181C]
        transition-colors duration-200
      "
    >
      <div className="flex gap-3 p-4">
        {/* AVATAR */}
        <img
          src={avatarUrl}
          alt={user.username}
          className="h-10 w-10 rounded-full object-cover mt-1"
        />

        {/* CONTENT */}
        <div className="flex flex-col flex-1 min-w-0">
          <PostHeader
            price={0}
            username={user.username}
            timestamp={timestamp}
            type="normal_post"
          />

          {description && (
            <p className="text-gray-800 dark:text-gray-200 mt-2 mb-4">
              {description}
            </p>
          )}

          {/* MEDIA */}
          <div className="relative overflow-hidden w-full h-[400px] rounded-xl bg-gray-100 dark:bg-gray-700">
            {asset ? (
              isVideo ? (
                <video
                  controls
                  className="w-full h-full object-contain"
                  src={asset.url}
                />
              ) : (
                <img
                  src={asset.url}
                  alt={asset.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              )
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                No media available
              </div>
            )}
          </div>

          {/* INTERACTIONS */}
          <PostInteractions
            likes={likesCount}
            comments={comments}
            isLiked={isLiked}
            isWishlisted={isWishlisted}
            onLike={handleLike}
            onWishlist={handleWishlist}
            onCommentToggle={() => setShowComments(!showComments)}
          />

          {/* COMMENTS */}
          {showComments && (
            <CommentSection postId={_id} BACKEND_URL={BACKEND_URL} />
          )}
        </div>
      </div>
    </article>
  );
};

export default memo(NormalPost);
