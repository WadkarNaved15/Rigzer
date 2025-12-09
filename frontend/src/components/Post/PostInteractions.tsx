import React, { useState, memo } from 'react';
import { Heart, MessageCircle, Share2, Bookmark } from 'lucide-react';
import CommentSection from './CommentSection';

interface PostInteractionsProps {
  likes: number;
  comments: number;
  isLiked?: boolean;
  isWishlisted?: boolean; 
  onLike?: () => void;
  onWishlist?: () => void; 
  onCommentToggle?: () => void;
}

const PostInteractions: React.FC<PostInteractionsProps> = ({
  likes,
  comments,
  isLiked = false,
  isWishlisted = false, 
  onLike,
  onWishlist, 
  onCommentToggle,
}) => {
  const [showComments, setShowComments] = useState(false);

  return (
    <div className="mt-4">
      {/* Buttons Row */}
      <div className="flex justify-between items-center">
        <div className="flex space-x-4">
          
          {/* ❤️ Like */}
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

          {/* 💬 Comment */}
          <button
            onClick={onCommentToggle}
            className="flex items-center text-gray-500 dark:text-gray-400 hover:text-blue-500 transition-colors"
            aria-label="Comment"
          >
            <MessageCircle className="h-5 w-5 mr-1" />
            <span>{comments}</span>
          </button>

          {/* ⭐ Wishlist */}
          <button
            onClick={onWishlist}
            className={`flex items-center transition-colors ${
              isWishlisted
                ? "text-yellow-500"
                : "text-gray-500 dark:text-gray-400 hover:text-yellow-400"
            }`}
            aria-label="Add to wishlist"
          >
            <Bookmark
              className={`h-5 w-5 mr-1 ${
                isWishlisted ? "fill-yellow-500" : ""
              }`}
            />
          </button>

          {/* 🔗 Share */}
          <button
            className="flex items-center text-gray-500 dark:text-gray-400 hover:text-green-500 transition-colors"
            aria-label="Share"
          >
            <Share2 className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Comment Section */}
      {/* {showComments && (
        <div className="mt-3">
          <CommentSection postId={postId} BACKEND_URL={BACKEND_URL} />
        </div>
      )} */}
    </div>
  );
};

export default memo(PostInteractions);
