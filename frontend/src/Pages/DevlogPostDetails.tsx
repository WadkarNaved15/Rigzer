import { ArrowLeft } from "lucide-react";
import DevlogPost from "../components/Post/DevlogPost";
import CommentSection from "../components/Post/CommentSection";

interface DevlogPostDetailsProps {
  post: any;
  BACKEND_URL: string;
  onClose: () => void;
}

const DevlogPostDetails: React.FC<DevlogPostDetailsProps> = ({
  post,
  BACKEND_URL,
  onClose,
}) => {
  return (
    <div className="w-full max-w-3xl mx-auto bg-white dark:bg-[#191919] border border-gray-200 dark:border-gray-700 rounded-xl">
      {/* 🔙 Back */}
      <button
        onClick={onClose}
        className="flex items-center gap-2 px-4 py-3 text-blue-500 hover:text-blue-600 border-b"
      >
        <ArrowLeft size={18} />
        Devlog
      </button>

      {/* 🧩 Devlog Post */}
      <DevlogPost {...post} disableInteractions />

      {/* 💬 Comments */}
      <CommentSection
        postId={post._id}
        BACKEND_URL={BACKEND_URL}
      />
    </div>
  );
};

export default DevlogPostDetails;
