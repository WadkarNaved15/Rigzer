// postModal/index.tsx
import { useState } from "react";
import PostTypeHeader from "./PostTypeHeader";
import ActivePostForm from "./ActivePostForm";
import { PostType } from "../../types/postTypes";
import { useNavigate } from "react-router-dom";
const PostModalPage = () => {
  const [postType, setPostType] = useState<PostType>("model");
  const navigate= useNavigate();
  return (
    <div className="w-full min-h-screen bg-white dark:bg-[#191919] flex flex-row">
      
      {/* Sidebar - Tightened width to bring icons closer to form */}
      <aside className="w-16 md:w-20 flex flex-col items-center py-6 sticky top-0 h-screen bg-white dark:bg-[#191919]">
        <PostTypeHeader 
          active={postType} 
          onChange={setPostType} 
          onCancel={() => navigate(-1)}
        />
      </aside>

      {/* Main Content - Reduced left padding (pl-4) to close the gap */}
      <main className="flex-1 overflow-y-auto bg-white dark:bg-[#191919]">
        <div className="max-w-2xl ml-0 mr-auto py-8 pl-4 pr-8">
          <ActivePostForm
            postType={postType}
            onCancel={() => navigate(-1)}
          />
        </div>
      </main>
    </div>
  );
};
export default PostModalPage;