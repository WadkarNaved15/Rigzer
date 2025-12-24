import React, { memo, useMemo, useEffect, useRef, useState } from "react";
import PostHeader from "./PostHeader";
import PostInteractions from "./PostInteractions";
import CommentSection from "./CommentSection";
import { useLikes } from "../../hooks/useLikes";
import { useWishlist } from "../../hooks/useWishlist";
import type { NormalPostProps } from "../../types/Post";
import { ChevronLeft, ChevronRight } from "lucide-react"; // Optional: for arrows

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
  const [currentIndex, setCurrentIndex] = useState(0); // Track current image/video
  const postRef = useRef<HTMLDivElement>(null);

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
  const { likesCount, isLiked, handleLike } = useLikes(_id, BACKEND_URL);
  const { isWishlisted, handleWishlist } = useWishlist(_id, BACKEND_URL);

  // Logic for the assets array
  const assets = normalPost?.assets || [];
  const hasMultiple = assets.length > 1;

  const nextSlide = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentIndex < assets.length - 1) setCurrentIndex(prev => prev + 1);
  };

  const prevSlide = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
  };

  // Timestamp calculation
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

    return created.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
    <article ref={postRef} className="relative w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-black hover:bg-[#F7F9F9] dark:hover:bg-[#16181C] transition-colors duration-200">
      <div className="flex gap-3 p-4">
        <img src={avatarUrl} alt={user.username} className="h-10 w-10 rounded-full object-cover mt-1" />

        <div className="flex flex-col flex-1 min-w-0">
          <PostHeader price={0} username={user.username} timestamp={timestamp} type="normal_post" />

          {description && <p className="text-gray-800 dark:text-gray-200 mt-2 mb-4">{description}</p>}

          {/* MEDIA SLIDER CONTAINER */}
          <div className="group relative overflow-hidden w-full h-[400px] rounded-xl bg-gray-100 dark:bg-gray-800">
            
            {/* Asset Wrapper: Slides left/right based on index */}
            <div 
              className="flex h-full transition-transform duration-300 ease-out" 
              style={{ transform: `translateX(-${currentIndex * 100}%)` }}
            >
              {assets.length > 0 ? (
                assets.map((asset: any, index: number) => (
                  <div key={index} className="min-w-full h-full flex-shrink-0">
                    {asset.type === "video" ? (
                      <video controls className="w-full h-full object-contain bg-black" src={asset.url} />
                    ) : (
                      <img src={asset.url} alt={asset.name} className="w-full h-full object-cover" loading="lazy" />
                    )}
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center w-full h-full text-gray-500">No media available</div>
              )}
            </div>

            {/* NAVIGATION ARROWS (Visible on hover) */}
            {hasMultiple && (
              <>
                {currentIndex > 0 && (
                  <button onClick={prevSlide} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 p-1.5 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    <ChevronLeft size={20} />
                  </button>
                )}
                {currentIndex < assets.length - 1 && (
                  <button onClick={nextSlide} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 p-1.5 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    <ChevronRight size={20} />
                  </button>
                )}
              </>
            )}

            {/* PAGINATION DOTS */}
            {hasMultiple && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {assets.map((_: any, idx: number) => (
                  <div key={idx} className={`h-1.5 w-1.5 rounded-full transition-all ${idx === currentIndex ? "bg-blue-500 w-3" : "bg-white/60"}`} />
                ))}
              </div>
            )}
          </div>

          <PostInteractions
            likes={likesCount}
            comments={comments}
            isLiked={isLiked}
            isWishlisted={isWishlisted}
            onLike={handleLike}
            onWishlist={handleWishlist}
            onCommentToggle={() => setShowComments(!showComments)}
          />

          {showComments && <CommentSection postId={_id} BACKEND_URL={BACKEND_URL} />}
        </div>
      </div>
    </article>
  );
};

export default memo(NormalPost);