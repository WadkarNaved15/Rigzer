import { useEffect, useState } from "react";
import axios from "axios";

export function useWishlist(
  postId: string,
  BACKEND_URL: string,
  initialWishlisted: boolean // ✅ new param
) {
  const [isWishlisted, setIsWishlisted] = useState(initialWishlisted);

  const handleWishlist = async () => {
    try {
      // 🔥 Optimistic update (instant UI)
      setIsWishlisted((prev) => !prev);

      if (!isWishlisted) {
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
      // rollback if failed
      setIsWishlisted((prev) => !prev);
      console.error("Error wishlisting post:", err);
    }
  };

  return { isWishlisted, handleWishlist };
}
