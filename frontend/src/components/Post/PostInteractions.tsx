import React, { memo } from 'react';
import { Heart, MessageCircle, Share2 } from 'lucide-react';

interface PostInteractionsProps {
  likes: number;
  comments: number;
  isLiked?: boolean;
  onLike?: () => void;
}

const PostInteractions: React.FC<PostInteractionsProps> = ({
  likes,
  comments,
  isLiked = false,
  onLike
}) => {
  return (
    <div className="flex mt-4 justify-between items-center">
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
  );
};

export default memo(PostInteractions);
