// postModal/index.tsx
import { useState } from "react";
import PostTypeHeader from "./PostTypeHeader";
import ActivePostForm from "./ActivePostForm";
import { PostType } from "../../types/postTypes";

const PostModalPage = ({ onCancel }: { onCancel: () => void }) => {
  const [postType, setPostType] = useState<PostType>("model");

  return (
    <div className="w-full min-h-screen bg-white dark:bg-black flex flex-row">
      
      {/* Sidebar - Tightened width to bring icons closer to form */}
      <aside className="w-16 md:w-20 flex flex-col items-center py-6 sticky top-0 h-screen bg-white dark:bg-black">
        <PostTypeHeader 
          active={postType} 
          onChange={setPostType} 
          onCancel={onCancel}
        />
      </aside>

      {/* Main Content - Reduced left padding (pl-4) to close the gap */}
      <main className="flex-1 overflow-y-auto bg-white dark:bg-black">
        <div className="max-w-2xl ml-0 mr-auto py-8 pl-4 pr-8">
          <ActivePostForm
            postType={postType}
            onCancel={onCancel}
          />
        </div>
      </main>
    </div>
  );
};
export default PostModalPage;