import { useEffect, useState } from "react";
import axios from "axios";

export function useLikes(postId: string, BACKEND_URL: string, initialLikes: number, initialIsLiked: boolean) {
  const [likesCount, setLikesCount] = useState(initialLikes);
  const [loading, setLoading] = useState(false);
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  useEffect(() => {
    setLikesCount(initialLikes);
    setIsLiked(initialIsLiked);
  }, [initialLikes, initialIsLiked]);

  const handleLike = async () => {
    if (loading) return;
    setLoading(true);

    const previousLiked = isLiked;

    // Optimistic update (instant UI change)
    setIsLiked(!previousLiked);
    setLikesCount(prev =>
      previousLiked ? prev - 1 : prev + 1
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
      console.error("Error liking post:", err);

      // 🔥 Revert if failed
      setIsLiked(previousLiked);
      setLikesCount(prev =>
        previousLiked ? prev + 1 : prev - 1
      );
    } finally {
      setLoading(false);
    }
  };

  return { likesCount, isLiked, handleLike };
}
