import React, { useState, memo } from 'react';
import { Heart, MessageCircle, Share2 } from 'lucide-react';
import CommentSection from './CommentSection';

interface PostInteractionsProps {
  likes: number;
  comments: number;
  postId: string; // ✅ Add this
  BACKEND_URL: string; // ✅ Add this
  isLiked?: boolean;
  onLike?: () => void;
  onCommentToggle?: () => void; // ✅ callback from parent
}

const PostInteractions: React.FC<PostInteractionsProps> = ({
  likes,
  comments,
  postId,
  BACKEND_URL,
  isLiked = false,
  onLike,
  onCommentToggle,
}) => {
  const [showComments, setShowComments] = useState(false);

  return (
    <div className="mt-4">
      {/* Buttons Row */}
      <div className="flex justify-between items-center">
        <div className="flex space-x-4">
          <button
            onClick={onLike}
            className={`flex items-center transition-colors ${
              isLiked
                ? "text-red-500"
                : "text-gray-500 dark:text-gray-400 hover:text-red-400"
            }`}
            aria-label="Like post"
          >
            <Heart
              className={`h-5 w-5 mr-1 ${isLiked ? "fill-red-500" : ""}`}
            />
            <span>{likes}</span>
          </button>

          <button
          onClick={onCommentToggle}
          className="flex items-center text-gray-500 dark:text-gray-400 hover:text-blue-500 transition-colors"
          aria-label="Comment"
        >
          <MessageCircle className="h-5 w-5 mr-1" />
          <span>{comments}</span>
        </button>

          <button
            className="flex items-center text-gray-500 dark:text-gray-400 hover:text-green-500 transition-colors"
            aria-label="Share"
          >
            <Share2 className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* ✅ Show Comment Section when clicked */}
      {showComments && (
        <div className="mt-3">
          <CommentSection postId={postId} BACKEND_URL={BACKEND_URL} />
        </div>
      )}
    </div>
  );
};

export default memo(PostInteractions);
