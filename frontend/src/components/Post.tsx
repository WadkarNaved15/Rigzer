import React, { Suspense, lazy } from "react";
import type { PostProps } from "../types/Post";

// Lazy load post components
const NormalPost = lazy(() => import("./Post/NormalPost"));
const GamePost = lazy(() => import("./Post/GamePost"));
const ExePost = lazy(() => import("./Post/ExePost"));

type PostWrapperProps = PostProps & {
  onOpenDetails?: () => void;
};

// Small fallback component for suspense
const Fallback = () => (
  <div className="w-full h-32 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
);

export const Post: React.FC<PostWrapperProps> = (props) => {
  const { type } = props;

  const RenderedPost = (() => {
    switch (type) {
      case "game_post":
        return GamePost as React.ComponentType<PostWrapperProps>;
      case "exe_post":
        return ExePost as React.ComponentType<PostWrapperProps>;
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
