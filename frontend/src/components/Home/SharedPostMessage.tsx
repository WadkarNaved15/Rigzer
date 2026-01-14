import axios from "axios";
import { useEffect, useState, useMemo } from "react";
import { Play } from "lucide-react";

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

  const timestamp = useMemo(() => {
    if (!post?.createdAt) return "";
    const now = new Date();
    const created = new Date(post.createdAt);
    const diffMs = now.getTime() - created.getTime();
    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) return `${seconds}s`;
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    return created.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }, [post?.createdAt]);

  if (deleted) {
    return (
      <div className="p-3 bg-gray-50 dark:bg-[#16181C] border border-gray-200 dark:border-gray-800 rounded-2xl text-sm text-gray-500 italic">
        This post is no longer available
      </div>
    );
  }

  if (!post) {
    return <div className="p-4 animate-pulse text-gray-400 text-xs">Loading preview...</div>;
  }

  const assets = post.normalPost?.assets || post.modelPost?.assets || [];
  const type = post.type;
  const isVideo = assets[0]?.type === "video";
  const previewImage = type === "devlog_post" 
    ? post.devlogMeta?.thumbnail 
    : (post.modelPost?.previewImage || assets[0]?.url);

  return (
    <div
      onClick={() => onOpenPost(post._id)}
      className="group max-w-[300px] sm:max-w-[350px] overflow-hidden border border-gray-200 dark:border-gray-800 rounded-2xl cursor-pointer transition-all duration-200 bg-white dark:bg-[#191919] hover:bg-gray-50 dark:hover:bg-[#202020] shadow-sm hover:shadow-md"
    >
      {/* Media Section */}
      {previewImage && (
        <div className="relative w-full h-44 overflow-hidden bg-gray-100 dark:bg-black border-b border-gray-100 dark:border-gray-800">
          <img
            src={previewImage}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            alt="post preview"
          />
          
          {/* Subtle Gradient Overlay for readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />

          {isVideo && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-black/40 backdrop-blur-md p-2.5 rounded-full border border-white/20">
                <Play className="h-7 w-7 text-white fill-white" />
              </div>
            </div>
          )}

          {/* Price Tag (X-Style) */}
          {type === 'model_post' && post.modelPost?.price > 0 && (
            <div className="absolute top-2 right-2 bg-[#5799EF] text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-lg border border-white/10">
              ${post.modelPost.price}
            </div>
          )}
        </div>
      )}

      {/* Content Section */}
      <div className="p-3.5">
        {/* User Info */}
        <div className="flex items-center gap-2 mb-2">
          <img 
            src={post.user?.profilePic || DEFAULT_AVATAR} 
            className="w-5 h-5 rounded-full object-cover ring-1 ring-gray-200 dark:ring-gray-800" 
            alt="avatar" 
          />
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-bold text-[14px] text-gray-900 dark:text-white truncate">
              {post.user?.username}
            </span>
            <span className="text-gray-400 text-[10px]">•</span>
            <span className="text-gray-500 dark:text-gray-400 text-[12px] font-medium">
              {timestamp}
            </span>
          </div>
        </div>

        {/* Description */}
        <p className="text-[14px] leading-[1.4] text-gray-700 dark:text-gray-200 line-clamp-2 break-words whitespace-pre-wrap mb-2">
          {post.description}
        </p>

        {/* Dynamic Type Badge */}
        {type !== "normal_post" && (
          <div className="flex items-center">
            <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-[#262626] text-[9px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
              {type.split('_')[0]} {type.split('_')[1] || ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}