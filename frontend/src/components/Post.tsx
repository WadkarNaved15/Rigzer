import React, { Suspense, lazy } from "react";
import type { PostProps } from "../types/Post";

// Lazy load post components
const NormalPost  = lazy(() => import("./Post/NormalPost"));
const GamePost    = lazy(() => import("./Post/GamePost"));
const ExePost     = lazy(() => import("./Post/ExePost"));
const DevlogPost  = lazy(() => import("./Post/DevlogPost"));
const AdModelPost = lazy(() => import("./Post/AdModelPost")); // ⭐ NEW
const PocketPost   = lazy(() => import("./Post/PocketPost"));   // ⭐ NEW

type PostWrapperProps = PostProps & {
  onOpenDetails?: () => void;
};

const Fallback = () => (
  <div className="w-full h-32 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
);

export const Post: React.FC<PostWrapperProps> = (props) => {
  const { type } = props;

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
    <Suspense fallback={<Fallback />}>
      <RenderedPost {...props} />
    </Suspense>
  );
};

export default Post;