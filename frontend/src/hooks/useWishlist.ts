import { useEffect, useState } from "react";
import axios from "axios";

export function useWishlist(postId: string, BACKEND_URL: string) {
  const [isWishlisted, setIsWishlisted] = useState(false);
  useEffect(() => {
    const fetchWishlistData = async () => {
      try {
        const [checkRes] = await Promise.all([
          axios.get(`${BACKEND_URL}/api/wishlist/check`, { params: { postId }, withCredentials: true }),
        ]);

        setIsWishlisted(checkRes.data.wishlisted);
      } catch (err) {
        console.error("Error fetching wishlist data:", err);
      }
    };

    fetchWishlistData();
  }, [postId]);
  const handleWishlist = async () => {
    try {
      if (!isWishlisted) {
        await axios.post(`${BACKEND_URL}/api/wishlist`, { postId }, { withCredentials: true });
      } else {
        await axios.delete(`${BACKEND_URL}/api/wishlist`, { data: { postId }, withCredentials: true });
      }
      setIsWishlisted(!isWishlisted);
    } catch (err) {
      console.error("Error wishlisting post:", err);
    }
  };

  return { isWishlisted, handleWishlist};

}
