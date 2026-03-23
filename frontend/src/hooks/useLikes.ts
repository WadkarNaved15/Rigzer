import { useState } from "react";
import axios from "axios";
import { useFeed } from "../context/FeedContext";

export function useLikes(postId: string, BACKEND_URL: string) {
  const { posts, setPosts } = useFeed();
  const [loading, setLoading] = useState(false);

  const currentPost = posts.find(p => p._id === postId);

  const handleLike = async () => {
    if (!currentPost || loading) return;

    setLoading(true);

    const previousLiked = currentPost.isLiked;

    // 🔥 UPDATE GLOBAL STATE (not local)
    setPosts(prev =>
      prev.map(post =>
        post._id === postId
          ? {
              ...post,
              isLiked: !previousLiked,
              likesCount: previousLiked
                ? (post.likesCount ?? 0) - 1
                : (post.likesCount ?? 0) + 1,
            }
          : post
      )
    );

    try {
      if (!previousLiked) {
        await axios.post(
          `${BACKEND_URL}/api/likes`,
          { postId },
          { withCredentials: true }
        );
      } else {
        await axios.delete(
          `${BACKEND_URL}/api/likes`,
          { data: { postId }, withCredentials: true }
        );
      }
    } catch (err) {
      console.error(err);

      // 🔥 REVERT GLOBAL STATE
      setPosts(prev =>
        prev.map(post =>
          post._id === postId
            ? {
                ...post,
                isLiked: previousLiked,
                likesCount: previousLiked
                  ? (post.likesCount ?? 0) + 1
                  : (post.likesCount ?? 0) - 1,
              }
            : post
        )
      );
    } finally {
      setLoading(false);
    }
  };

  return {
    likesCount: currentPost?.likesCount || 0,
    isLiked: currentPost?.isLiked || false,
    handleLike,
  };
}