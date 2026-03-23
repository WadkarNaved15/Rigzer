import { useState } from "react";
import axios from "axios";
import { useFeed } from "../context/FeedContext";

export function useWishlist(postId: string, BACKEND_URL: string) {
  const { posts, setPosts } = useFeed();
  const [loading, setLoading] = useState(false);

  const currentPost = posts.find(p => p._id === postId);

  const handleWishlist = async () => {
    if (!currentPost || loading) return;

    setLoading(true);

    const previous = currentPost.isWishlisted;

    // 🔥 OPTIMISTIC GLOBAL UPDATE
    setPosts(prev =>
      prev.map(post =>
        post._id === postId
          ? { ...post, isWishlisted: !previous }
          : post
      )
    );

    try {
      if (!previous) {
        await axios.post(
          `${BACKEND_URL}/api/wishlist`,
          { postId },
          { withCredentials: true }
        );
      } else {
        await axios.delete(
          `${BACKEND_URL}/api/wishlist`,
          { data: { postId }, withCredentials: true }
        );
      }
    } catch (err) {
      console.error("Wishlist error:", err);

      // 🔥 REVERT GLOBAL STATE
      setPosts(prev =>
        prev.map(post =>
          post._id === postId
            ? { ...post, isWishlisted: previous }
            : post
        )
      );
    } finally {
      setLoading(false);
    }
  };

  return {
    isWishlisted: currentPost?.isWishlisted || false,
    handleWishlist,
  };
}