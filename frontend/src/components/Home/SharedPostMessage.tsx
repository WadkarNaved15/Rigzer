import axios from "axios";
import { useEffect, useState } from "react";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
const DEFAULT_AVATAR = "https://images.unsplash.com/photo-1494790108377-be9c29b29330";

export default function SharedPostMessage({ postId, onOpenPost }: any) {
  const [post, setPost] = useState<any>(null);
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    axios
      .get(`${BACKEND_URL}/api/posts/${postId}`)
      .then((res) => setPost(res.data))
      .catch(() => setDeleted(true));
  }, [postId]);

  if (deleted) {
    return (
      <div className="p-3 bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-700 rounded-2xl text-sm text-gray-500 italic">
        This post is no longer available
      </div>
    );
  }

  if (!post) {
    return <div className="p-3 animate-pulse text-gray-400 text-xs">Loading preview...</div>;
  }

  // Resolve preview image dynamically
  let previewImage: string | null = null;
  if (post.type === "normal_post") previewImage = post.normalPost?.assets?.[0]?.url;
  if (post.type === "model_post") previewImage = post.modelPost?.previewImage || post.modelPost?.assets?.[0]?.url;
  if (post.type === "devlog_post") previewImage = post.devlogMeta?.thumbnail;

  return (
    <div
      onClick={() => onOpenPost(post._id)}
      className="group max-w-sm overflow-hidden border border-gray-200 dark:border-zinc-700 rounded-2xl cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-zinc-800/50"
    >
      {/* Media Section */}
      {previewImage && (
        <div className="relative w-full h-44 overflow-hidden border-b border-gray-100 dark:border-zinc-800">
          <img
            src={previewImage}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            alt="post preview"
          />
        </div>
      )}

      {/* Content Section */}
      <div className="p-3">
        {/* User Info Header */}
        <div className="flex items-center gap-2 mb-1.5">
          <img 
            src={post.user?.profilePic || DEFAULT_AVATAR} 
            className="w-5 h-5 rounded-full object-cover" 
            alt="avatar" 
          />
          <span className="font-bold text-[14px] text-gray-900 dark:text-white truncate">
            {post.user?.username || "User"}
          </span>
          <span className="text-gray-500 dark:text-zinc-500 text-[13px]">
            @{post.user?.username?.toLowerCase().replace(/\s/g, '')}
          </span>
        </div>

        {/* Description */}
        <p className="text-[14px] leading-snug text-gray-800 dark:text-zinc-200 line-clamp-3 break-words">
          {post.description}
        </p>
        
        {/* Optional: Post Type Tag */}
        {post.type !== "normal_post" && (
          <div className="mt-2 inline-block px-2 py-0.5 rounded-md bg-gray-100 dark:bg-zinc-800 text-[10px] font-bold uppercase tracking-wider text-gray-500">
            {post.type.replace('_', ' ')}
          </div>
        )}
      </div>
    </div>
  );
}