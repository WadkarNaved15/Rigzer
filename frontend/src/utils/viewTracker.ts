// utils/viewTracker.ts

const viewedPosts = new Set<string>();

export const hasViewedPost = (postId: string) => {
  return viewedPosts.has(postId);
};

export const markPostViewed = (postId: string) => {
  viewedPosts.add(postId);
};