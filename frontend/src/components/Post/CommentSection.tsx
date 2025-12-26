import React, { useState, useEffect, useRef, memo } from "react";
import axios from "axios";
import { Send, Link as LinkIcon, MessageSquare } from "lucide-react"; // Optional: npm install lucide-react

interface Comment {
  _id: string;
  postId: string;
  text: string;
  user?: { username: string };
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

/* ✅ ENHANCED COMMENT CARD */
const CommentCard = memo(({ comment, BACKEND_URL, linkPreviewCache }: any) => {
  const [linkPreview, setLinkPreview] = useState<LinkPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const urls = comment.text.match(urlRegex);
  const url = urls?.[0];
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!url || fetchedRef.current) return;

    if (linkPreviewCache.current[url]) {
      setLinkPreview(linkPreviewCache.current[url]);
      fetchedRef.current = true;
      return;
    }

    const fetchMetadata = async () => {
      setLoadingPreview(true);
      try {
        const { data } = await axios.get(`${BACKEND_URL}/api/metadata`, { params: { url } });
        const meta = { ...data, url };
        linkPreviewCache.current[url] = meta;
        setLinkPreview(meta);
      } catch (error) {
        console.error("Error fetching metadata:", error);
      } finally {
        setLoadingPreview(false);
        fetchedRef.current = true;
      }
    };
    fetchMetadata();
  }, [url, BACKEND_URL, linkPreviewCache]);

  return (
    <div className="flex gap-3 py-4 group">
      {/* Avatar Placeholder */}
      <div className="flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
          {comment.user?.username?.charAt(0).toUpperCase() || "U"}
        </div>
      </div>

      <div className="flex-grow">
        <div className="bg-gray-50 dark:bg-zinc-900 rounded-2xl px-4 py-3 shadow-sm border border-gray-100 dark:border-zinc-800">
          <div className="flex justify-between items-center mb-1">
            <span className="font-bold text-sm text-gray-900 dark:text-gray-100">
              {comment.user?.username || "Anonymous"}
            </span>
            <span className="text-[11px] text-gray-400 font-medium">
              {new Date(comment.createdAt).toLocaleDateString()}
            </span>
          </div>
          
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            {comment.text.split(urlRegex).map((part: string, i: number) =>
              urlRegex.test(part) ? (
                <a key={i} href={part} target="_blank" rel="noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5">
                  <LinkIcon size={12} /> {new URL(part).hostname}
                </a>
              ) : (
                <span key={i}>{part}</span>
              )
            )}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-4 mt-1.5 ml-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
          <button className="hover:text-blue-600 transition-colors">Like</button>
          <button className="hover:text-blue-600 transition-colors">Reply</button>
        </div>

        {/* Enhanced Link Preview */}
        {loadingPreview && (
          <div className="mt-3 h-24 w-full bg-gray-100 dark:bg-zinc-800 animate-pulse rounded-xl" />
        )}

        {linkPreview && (
          <a
            href={linkPreview.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block mt-3 bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden hover:border-blue-400 dark:hover:border-blue-500 transition-all shadow-sm"
          >
            <div className="flex flex-col sm:flex-row">
              {linkPreview.image && (
                <img src={linkPreview.image} className="sm:w-32 h-32 sm:h-auto object-cover border-b sm:border-b-0 sm:border-r border-gray-100 dark:border-zinc-800" alt="" />
              )}
              <div className="p-3 overflow-hidden">
                <h4 className="font-bold text-xs text-gray-900 dark:text-gray-100 truncate">{linkPreview.title}</h4>
                <p className="text-[11px] text-gray-500 line-clamp-2 mt-1">{linkPreview.description}</p>
                <p className="text-[10px] text-blue-500 mt-2 font-mono uppercase tracking-wider">{new URL(linkPreview.url!).hostname}</p>
              </div>
            </div>
          </a>
        )}
      </div>
    </div>
  );
});

/* ✅ ENHANCED MAIN SECTION */
const CommentSection: React.FC<CommentSectionProps> = ({ postId, BACKEND_URL }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const linkPreviewCache = useRef<Record<string, LinkPreview>>({});

  useEffect(() => {
    const fetchComments = async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/api/comments`, { params: { postId } });
        setComments(res.data);
      } catch (err) { console.error(err); }
    };
    fetchComments();
  }, [postId, BACKEND_URL]);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    try {
      const res = await axios.post(`${BACKEND_URL}/api/comments`, { postId, text: newComment }, { withCredentials: true });
      setComments((prev) => [res.data, ...prev]);
      setNewComment("");
    } catch (err) { console.error(err); }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white dark:bg-black rounded-xl overflow-hidden shadow-sm">
      <div className="p-4 border-b border-gray-100 dark:border-zinc-800 flex items-center gap-2">
        <MessageSquare size={18} className="text-blue-500" />
        <h3 className="font-bold text-gray-900 dark:text-gray-100">Discussion ({comments.length})</h3>
      </div>

      {/* Input Area */}
      <div className="p-4 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50">
        <div className="relative group">
          <textarea
            rows={1}
            className="w-full bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-2xl pl-4 pr-12 py-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none"
            placeholder="Share your thoughts..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
          />
          <button
            onClick={handleAddComment}
            disabled={!newComment.trim()}
            className="absolute right-2 top-2 p-1.5 bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-zinc-800 text-white rounded-xl hover:bg-blue-700 transition-all"
          >
            <Send size={18} />
          </button>
        </div>
      </div>

      {/* Scrollable List */}
      <div className="px-4 max-h-[500px] overflow-y-auto divide-y divide-gray-50 dark:divide-zinc-900">
        {comments.length > 0 ? (
          comments.map((c) => (
            <CommentCard key={c._id} comment={c} BACKEND_URL={BACKEND_URL} linkPreviewCache={linkPreviewCache} />
          ))
        ) : (
          <div className="py-10 text-center text-gray-400 text-sm italic">
            Be the first to start the conversation!
          </div>
        )}
      </div>
    </div>
  );
};

export default CommentSection;