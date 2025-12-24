import React, { memo, useMemo, useEffect, useRef, useState } from "react";
import PostHeader from "./PostHeader";
import PostInteractions from "./PostInteractions";
import CommentSection from "./CommentSection";
import { useLikes } from "../../hooks/useLikes";
import { useWishlist } from "../../hooks/useWishlist";
import type { NormalPostProps } from "../../types/Post";
import { ChevronLeft, ChevronRight } from "lucide-react";

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
  const [currentIndex, setCurrentIndex] = useState(0);
  const postRef = useRef<HTMLDivElement>(null);

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
  const { likesCount, isLiked, handleLike } = useLikes(_id, BACKEND_URL);
  const { isWishlisted, handleWishlist } = useWishlist(_id, BACKEND_URL);

  // Reference your schema: normalPost.assets is the array
  const allAssets = normalPost?.assets || [];
  const totalAssets = allAssets.length;

  const nextSlide = () => {
    if (currentIndex < totalAssets - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const prevSlide = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  // Instagram Style: Tap right side for next, left side for previous
  const handleMediaClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left; // get click position relative to container
    if (x > rect.width / 2) {
      nextSlide();
    } else {
      prevSlide();
    }
  };

  // --- Helpers ---
  const getRelativeTime = (date: string | Date) => {
    const now = new Date();
    const created = new Date(date);
    const diffMs = now.getTime() - created.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    if (hours < 24) return `${hours}h`;
    return created.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  const timestamp = useMemo(() => getRelativeTime(createdAt), [createdAt]);

  return (
    <article ref={postRef} className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-black">
      <div className="flex gap-3 p-4">
        <img src={avatarUrl} alt={user.username} className="h-10 w-10 rounded-full object-cover mt-1" />

        <div className="flex flex-col flex-1 min-w-0">
          <PostHeader price={0} username={user.username} timestamp={timestamp} type="normal_post" />

          {description && <p className="text-gray-800 dark:text-gray-200 mt-2 mb-4">{description}</p>}

          {/* MAIN MEDIA CONTAINER */}
          <div className="relative group w-full h-[450px] rounded-xl overflow-hidden bg-black">
            
            {/* The "Slider" Track */}
            <div 
              className="flex h-full transition-transform duration-500 ease-in-out"
              style={{ transform: `translateX(-${currentIndex * 100}%)` }}
              onClick={handleMediaClick}
            >
              {allAssets.map((asset, index) => (
                <div key={index} className="min-w-full h-full flex-shrink-0 relative">
                  {asset.type === "video" ? (
                    <video 
                      src={asset.url} 
                      className="w-full h-full object-contain" 
                      controls 
                      playsInline
                    />
                  ) : (
                    <img 
                      src={asset.url} 
                      alt={asset.name} 
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Overlay Navigation UI */}
            {totalAssets > 1 && (
              <>
                {/* Visual Arrows */}
                {currentIndex > 0 && (
                  <button onClick={(e) => { e.stopPropagation(); prevSlide(); }} className="absolute left-2 top-1/2 -translate-y-1/2 p-1 bg-black/40 rounded-full text-white hover:bg-black/60 z-10">
                    <ChevronLeft size={24} />
                  </button>
                )}
                {currentIndex < totalAssets - 1 && (
                  <button onClick={(e) => { e.stopPropagation(); nextSlide(); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 bg-black/40 rounded-full text-white hover:bg-black/60 z-10">
                    <ChevronRight size={24} />
                  </button>
                )}

                {/* Counter Tag (e.g., 1/3) */}
                <div className="absolute top-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                  {currentIndex + 1} / {totalAssets}
                </div>

                {/* Progress Dots */}
                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 pointer-events-none">
                  {allAssets.map((_, i) => (
                    <div 
                      key={i} 
                      className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${i === currentIndex ? "bg-white scale-125" : "bg-white/40"}`} 
                    />
                  ))}
                </div>
              </>
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