import React, { Suspense, lazy } from "react";
import type { PostProps } from "../types/Post";
import { useEffect, useRef } from "react";
import { hasViewedPost,markPostViewed } from "../utils/viewTracker";
// Lazy load post components
const NormalPost = lazy(() => import("./Post/NormalPost"));
const GamePost = lazy(() => import("./Post/GamePost"));
const ExePost = lazy(() => import("./Post/ExePost"));
const DevlogPost = lazy(() => import("./Post/DevlogPost"));
const AdModelPost = lazy(() => import("./Post/AdModelPost")); // ⭐ NEW
const PocketPost = lazy(() => import("./Post/PocketPost"));   // ⭐ NEW

type PostWrapperProps = PostProps & {
  onOpenDetails?: () => void;
};


const Fallback = () => (
  <div className="w-full h-32 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
);

export const Post: React.FC<PostWrapperProps> = (props) => {
  const { type, _id } = props;
  const postRef = useRef<HTMLDivElement | null>(null);
  
  useEffect(() => {
  if (!postRef.current) return;

  let timer: NodeJS.Timeout | null = null;
  let isVisible = false;

  const BACKEND_URL =
    import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

  const sendView = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/feedback/view`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: _id }),
      });
    } catch {}
  };

  const observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];

      // 🔥 GLOBAL GUARD (most important)
      if (hasViewedPost(_id)) return;

      if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
        isVisible = true;

        if (!timer) {
          timer = setTimeout(() => {
            if (!isVisible || hasViewedPost(_id)) return;

            // ✅ mark BEFORE sending (prevents race conditions)
            markPostViewed(_id);

            sendView();
            timer = null; // ✅ add this
          }, 1500); // slightly safer than 1000ms
        }
      } else {
        isVisible = false;

        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      }
    },
    {
      threshold: [0.7],
    }
  );

  observer.observe(postRef.current);

  return () => {
    observer.disconnect();
    if (timer) clearTimeout(timer);
  };
}, [_id]);
  

  const RenderedPost = (() => {
    switch (type) {
      case "game_post":
        return GamePost as React.ComponentType<PostWrapperProps>;
      case "model_post":
        return ExePost as React.ComponentType<PostWrapperProps>;
      case "devlog_post":
        return DevlogPost as React.ComponentType<PostWrapperProps>;
      case "ad_model_post":                                          // ⭐ NEW
        return AdModelPost as React.ComponentType<PostWrapperProps>; // ⭐ NEW
      case "pocket_update":                                           // ⭐ NEW
        return PocketPost as React.ComponentType<PostWrapperProps>; // ⭐ NEW
      default:
        return NormalPost as React.ComponentType<PostWrapperProps>;
    }
  })();

  return (
    <div ref={postRef}>
      <Suspense fallback={<Fallback />}>
        <RenderedPost {...props} />
      </Suspense>
    </div>
  );
};

export default Post;