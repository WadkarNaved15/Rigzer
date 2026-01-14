import axios from "axios";
import { useEffect, useState } from "react";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

export default function SharedPostMessage({ postId, onOpenPost }: any) {
  const [post, setPost] = useState<any>(null);
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    axios.get(`${BACKEND_URL}/api/posts/${postId}`)
      .then(res => setPost(res.data))
      .catch(() => setDeleted(true));
  }, [postId]);

  if (deleted) {
    return (
      <div className="p-3 bg-gray-100 dark:bg-zinc-800 rounded-lg text-sm text-gray-500">
        This post is no longer available
      </div>
    );
  }

  if (!post) return <div className="p-3">Loading...</div>;

  return (
    <div
      onClick={() => onOpenPost(post._id)}
      className="border rounded-xl overflow-hidden cursor-pointer hover:shadow-lg transition"
    >
      {post.assets?.[0] && (
        <img
          src={post.assets[0].url}
          className="w-full h-40 object-cover"
        />
      )}

      <div className="p-3">
        <p className="font-semibold">{post.user.username}</p>
        <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
          {post.description}
        </p>
      </div>
    </div>
  );
}
