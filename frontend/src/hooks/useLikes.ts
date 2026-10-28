import { usePosts } from "../context/PostContext";
import api from "../utils/api";
import { togglePostState } from "../utils/postToggleQueue";

export function useLikes(postId: string, BACKEND_URL: string) {
  const { postsById, updatePost } = usePosts();
  const currentPost = postsById[postId];

  const handleLike = () => {
    if (!currentPost) return;

    togglePostState({
      key: `like:${postId}`,
      initialActive: currentPost.isLiked ?? false,
      initialCount: currentPost.likesCount ?? 0,

      update: (isLiked, likesCount) => {
        updatePost(postId, {
          isLiked,
          likesCount,
        });
      },

      send: async (isLiked) => {
        if (isLiked) {
          const response = await api.post(
            `${BACKEND_URL}/api/likes`,
            { postId },
            { withCredentials: true }
          );

          return response.data.likesCount;
        }

        const response = await api.delete(
          `${BACKEND_URL}/api/likes`,
          {
            data: { postId },
            withCredentials: true,
          }
        );

        return response.data.likesCount;
      },
    });
  };

  return {
    likesCount: currentPost?.likesCount ?? 0,
    isLiked: currentPost?.isLiked ?? false,
    handleLike,
  };
}