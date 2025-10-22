import { useEffect, useState } from "react";
import axios from "axios";

export function useLikes(postId: string, BACKEND_URL: string) {
  const [likesCount, setLikesCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);

  useEffect(() => {
    const fetchLikeData = async () => {
      try {
        const [checkRes, countRes] = await Promise.all([
          axios.get(`${BACKEND_URL}/api/likes/check`, { params: { postId }, withCredentials: true }),
          axios.get(`${BACKEND_URL}/api/likes/count`, { params: { postId }, withCredentials: true }),
        ]);

        setIsLiked(checkRes.data.liked);
        setLikesCount(countRes.data.count);
      } catch (err) {
        console.error("Error fetching like data:", err);
      }
    };

    fetchLikeData();
  }, [postId]);

  const handleLike = async () => {
    try {
      if (!isLiked) {
        await axios.post(`${BACKEND_URL}/api/likes`, { postId }, { withCredentials: true });
        setLikesCount(prev => prev + 1);
      } else {
        await axios.delete(`${BACKEND_URL}/api/likes`, { data: { postId }, withCredentials: true });
        setLikesCount(prev => prev - 1);
      }
      setIsLiked(!isLiked);
    } catch (err) {
      console.error("Error liking post:", err);
    }
  };

  return { likesCount, isLiked, handleLike };
}
