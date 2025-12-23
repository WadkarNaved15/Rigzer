// postModal/index.tsx
import { useState } from "react";
import PostTypeHeader from "./PostTypeHeader";
import ActivePostForm from "./ActivePostForm";
import { PostType } from "../../types/postTypes";

const PostModalPage = ({ onCancel }: { onCancel: () => void }) => {
  const [postType, setPostType] = useState<PostType>("model");

  return (
    // Change: Changed background to match the form and removed py-8 px-4
    <div className="w-full min-h-screen bg-white dark:bg-black">
      <div className="max-w-2xl mx-auto flex flex-col">
        
        {/* Header container - Removed rounded-t and borders to make it seamless */}
        <div className="bg-white dark:bg-black border-b border-gray-100 dark:border-zinc-800">
          <PostTypeHeader 
            active={postType} 
            onChange={setPostType} 
            onCancel={onCancel}
          />
        </div>

        {/* Form container - Removed border and shadow-sm for a flat, clean look */}
        <div className="flex-1 bg-white dark:bg-black overflow-hidden relative">
          <ActivePostForm
            postType={postType}
            onCancel={onCancel}
          />
        </div>
      </div>
    </div>
  );
};
export default PostModalPage;