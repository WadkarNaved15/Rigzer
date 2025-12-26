import { ArrowLeft } from "lucide-react";
import NormalPost from "../components/Post/NormalPost";
import CommentSection from "../components/Post/CommentSection";

interface NormalPostDetailsProps {
  post: any;
  BACKEND_URL: string;
  onClose: () => void;
}

const NormalPostDetails: React.FC<NormalPostDetailsProps> = ({
  post,
  BACKEND_URL,
  onClose,
}) => {
  return (
    <div className="w-full max-w-3xl mx-auto bg-white dark:bg-black border border-gray-200 dark:border-gray-700 rounded-xl">
      {/* 🔙 Back */}
      <button
        onClick={onClose}
        className="flex items-center gap-2 px-4 py-3 text-blue-500 hover:text-blue-600 border-b"
      >
        <ArrowLeft size={18} />
        Back to feed
      </button>

      {/* 🧩 Post */}
      <NormalPost {...post} disableInteractions />

      {/* 💬 Comments */}
      <CommentSection
        postId={post._id}
        BACKEND_URL={BACKEND_URL}
      />
    </div>
  );
};

export default NormalPostDetails;
