import { usePosts } from "../context/PostContext";
import api from "../utils/api";
import { togglePostState } from "../utils/postToggleQueue";

export function useWishlist(postId: string, BACKEND_URL: string) {
  const { postsById, updatePost } = usePosts();
  const currentPost = postsById[postId];

  const handleWishlist = () => {
    if (!currentPost) return;

    togglePostState({
      key: `wishlist:${postId}`,
      initialActive: currentPost.isWishlisted ?? false,

      update: (isWishlisted) => {
        updatePost(postId, { isWishlisted });
      },

      send: async (isWishlisted) => {
        if (isWishlisted) {
          await api.post(
            `${BACKEND_URL}/api/wishlist`,
            { postId },
            { withCredentials: true }
          );
        } else {
          await api.delete(
            `${BACKEND_URL}/api/wishlist`,
            {
              data: { postId },
              withCredentials: true,
            }
          );
        }
      },
    });
  };

  return {
    isWishlisted: currentPost?.isWishlisted ?? false,
    handleWishlist,
  };
}