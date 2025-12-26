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
  onOpenDetails,
  disableInteractions,
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

  const assets = normalPost?.assets || [];
  const [currentIndex, setCurrentIndex] = useState(0);

  const hasMultipleAssets = assets.length > 1;

  const goNext = () => {
    setCurrentIndex((prev) => (prev + 1) % assets.length);
  };

  const goPrev = () => {
    setCurrentIndex((prev) =>
      prev === 0 ? assets.length - 1 : prev - 1
    );
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
      onClick={onOpenDetails}
      className="
        relative w-full 
        border border-gray-200 dark:border-gray-700
        bg-white dark:bg-black
        cursor-pointer
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
          {/* MEDIA CAROUSEL */}
          <div className="relative overflow-hidden w-full max-h-[500px] rounded-xl bg-black flex items-center justify-center">
            {assets.length > 0 ? (
              <>
                {/* --- ADDED: ASSET COUNTER --- */}
                {hasMultipleAssets && (
                  <div className="absolute top-3 right-3 z-10 bg-black/60 text-white px-2 py-1 rounded-md text-xs font-medium backdrop-blur-sm">
                    {currentIndex + 1} / {assets.length}
                  </div>
                )}
                {/* MEDIA */}
                {assets[currentIndex].type === "video" ? (
                  <video
                    controls
                    className="max-h-[500px] w-auto object-contain"
                    src={assets[currentIndex].url}
                  />
                ) : (
                  <img
                    src={assets[currentIndex].url}
                    alt={assets[currentIndex].name}
                    className="max-h-[500px] w-auto object-contain"
                    loading="lazy"
                  />

                )}

                {/* LEFT ARROW */}
                {hasMultipleAssets && (
                  <button
                    onClick={goPrev}
                    className="
            absolute left-2 top-1/2 -translate-y-1/2
            bg-black/50 text-white
            h-8 w-8 rounded-full
            flex items-center justify-center
            hover:bg-black/70
          "
                  >
                    ‹
                  </button>
                )}

                {/* RIGHT ARROW */}
                {hasMultipleAssets && (
                  <button
                    onClick={goNext}
                    className="
            absolute right-2 top-1/2 -translate-y-1/2
            bg-black/50 text-white
            h-8 w-8 rounded-full
            flex items-center justify-center
            hover:bg-black/70
          "
                  >
                    ›
                  </button>
                )}

                {/* DOT INDICATORS */}
                {hasMultipleAssets && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
                    {assets.map((_, index) => (
                      <span
                        key={index}
                        className={`h-2 w-2 rounded-full ${index === currentIndex
                          ? "bg-white"
                          : "bg-white/50"
                          }`}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                No media available
              </div>
            )}
          </div>


          {/* INTERACTIONS */}
          <div
            onClick={(e) => e.stopPropagation()}
          >
            <PostInteractions
              likes={likesCount}
              comments={comments}
              isLiked={isLiked}
              isWishlisted={isWishlisted}
              onLike={handleLike}
              onWishlist={handleWishlist}
              onCommentToggle={() => onOpenDetails?.()}
            />
          </div>


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
