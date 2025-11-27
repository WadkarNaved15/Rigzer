import React, { useState, useEffect, useRef, memo } from "react";
import axios from "axios";

interface Comment {
  _id: string;
  postId: string;
  text: string;
  user?: {
    username: string;
  };
  createdAt: string;
}

interface LinkPreview {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
}

interface CommentSectionProps {
  postId: string;
  BACKEND_URL: string;
}

const urlRegex = /(https?:\/\/[^\s]+)/g;

/* ✅ COMMENT CARD COMPONENT — OUTSIDE PARENT */
const CommentCard = memo(
  ({
    comment,
    BACKEND_URL,
    linkPreviewCache,
  }: {
    comment: Comment;
    BACKEND_URL: string;
    linkPreviewCache: React.MutableRefObject<Record<string, LinkPreview>>;
  }) => {
    const [linkPreview, setLinkPreview] = useState<LinkPreview | null>(null);
    const urls = comment.text.match(urlRegex);
    const url = urls?.[0];
    const fetchedRef = useRef(false);

    useEffect(() => {
      if (!url || fetchedRef.current) return;

      // ✅ Use cached data if available
      if (linkPreviewCache.current[url]) {
        setLinkPreview(linkPreviewCache.current[url]);
        fetchedRef.current = true;
        return;
      }

      // ✅ Fetch metadata and store in cache (without causing re-render)
      const fetchMetadata = async () => {
        try {
          const { data } = await axios.get(`${BACKEND_URL}/api/metadata`, { params: { url } });
          const meta = { ...data, url };
          linkPreviewCache.current[url] = meta;
          setLinkPreview(meta);
          fetchedRef.current = true;
        } catch (error) {
          console.error("Error fetching metadata:", error);
        }
      };

      fetchMetadata();
    }, [url, BACKEND_URL, linkPreviewCache]);

    return (
      <div className="border-b border-gray-200 pb-2">
        <p className="text-sm text-gray-800 dark:text-gray-200">
          <strong>{comment.user?.username || "User"}:</strong>{" "}
          {comment.text.split(urlRegex).map((part, index) =>
            urlRegex.test(part) ? (
              <a
                key={index}
                href={part}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 underline"
              >
                {part}
              </a>
            ) : (
              <span key={index}>{part}</span>
            )
          )}
        </p>

        <span className="text-xs text-gray-500">
          {new Date(comment.createdAt).toLocaleString()}
        </span>

        {linkPreview && (
          <a
            href={linkPreview.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block mt-2 border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden hover:shadow-lg transition-all"
          >
            {linkPreview.image && (
              <img
                src={linkPreview.image}
                alt={linkPreview.title || "Preview"}
                className="w-full h-48 object-cover"
              />
            )}
            <div className="p-3">
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                {linkPreview.title || "Untitled"}
              </h4>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                {linkPreview.description || ""}
              </p>
            </div>
          </a>
        )}
      </div>
    );
  }
);
CommentCard.displayName = "CommentCard";

/* ✅ MAIN COMMENT SECTION */
const CommentSection: React.FC<CommentSectionProps> = ({ postId, BACKEND_URL }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState<string>("");

  // ✅ Cache using useRef (doesn't trigger re-renders)
  const linkPreviewCache = useRef<Record<string, LinkPreview>>({});

  // 🧩 Fetch comments once
  useEffect(() => {
    const fetchComments = async () => {
      try {
        const res = await axios.get<Comment[]>(`${BACKEND_URL}/api/comments`, {
          params: { postId },
        });
        setComments(res.data);
      } catch (err) {
        console.error("Error fetching comments:", err);
      }
    };
    fetchComments();
  }, [postId, BACKEND_URL]);

  // 🧩 Add new comment
  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    try {
      const res = await axios.post<Comment>(
        `${BACKEND_URL}/api/comments`,
        { postId, text: newComment },
        { withCredentials: true }
      );
      setComments((prev) => [res.data, ...prev]);
      setNewComment("");
    } catch (err) {
      console.error("Error adding comment:", err);
    }
  };

  return (
    <div className="comment-section p-3 border-t border-gray-300">
      {/* ✏️ Input */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          className="flex-grow border border-gray-400 rounded-lg px-3 py-2 text-sm focus:outline-none"
          placeholder="Write a comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
        />
        <button
          onClick={handleAddComment}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all"
        >
          Post
        </button>
      </div>

      {/* 💬 Comments List */}
      <div className="space-y-3 max-h-64 overflow-y-auto">
        {comments.length > 0 ? (
          comments.map((c) => (
            <CommentCard
              key={c._id}
              comment={c}
              BACKEND_URL={BACKEND_URL}
              linkPreviewCache={linkPreviewCache}
            />
          ))
        ) : (
          <p className="text-gray-500 text-sm">No comments yet.</p>
        )}
      </div>
    </div>
  );
};

export default CommentSection;
