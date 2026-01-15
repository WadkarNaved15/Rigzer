import { X, Link2, Send, Share, Mail } from "lucide-react";
import { useState } from "react";
import SharePostModal from "./SharePostModal";
import { toast } from "react-toastify";

interface Props {
  postId: string;
  currentUserId: string;
  onClose: () => void;
}

export default function ShareActionModal({ postId, currentUserId, onClose }: Props) {
  const [openChatShare, setOpenChatShare] = useState(false);

  const shareLink = `${window.location.origin}/?post=${postId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      toast.success("Copied to clipboard", { position: "bottom-center", autoClose: 2000 });
      onClose();
    } catch (err) {
      toast.error("Failed to copy");
    }
  };

  const handleSystemShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Check out this post", url: shareLink });
        onClose();
      } catch (err) {
        // User cancelled or error
      }
    } else {
      handleCopy();
    }
  };

  if (openChatShare) {
    return (
      <SharePostModal
        postId={postId}
        currentUserId={currentUserId}
        onClose={() => {
          setOpenChatShare(false);
          onClose();
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] flex items-end sm:items-center justify-center z-[100] p-0 sm:p-4">
      {/* Click outside to close */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative bg-white dark:bg-[#191919] w-full max-w-[400px] rounded-t-[24px] sm:rounded-[20px] shadow-2xl overflow-hidden border-t sm:border border-gray-100 dark:border-zinc-800 animate-in slide-in-from-bottom-4 duration-200">
        
        {/* Mobile Grabber Handle */}
        <div className="flex justify-center py-2 sm:hidden">
          <div className="w-10 h-1 bg-gray-300 dark:bg-zinc-700 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 sm:py-4 border-b border-gray-100 dark:border-zinc-800">
          <h2 className="font-bold text-xl text-gray-900 dark:text-white">Share</h2>
          <button 
            onClick={onClose} 
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X size={20} className="text-gray-600 dark:text-zinc-400" />
          </button>
        </div>

        {/* Options List */}
        <div className="py-2 pb-6 sm:pb-2">
          
          <ShareOption 
            icon={<Send size={22} />} 
            label="Send via Direct Message" 
            onClick={() => setOpenChatShare(true)} 
          />
          
          <ShareOption 
            icon={<Link2 size={22} />} 
            label="Copy link" 
            onClick={handleCopy} 
          />

          <ShareOption 
            icon={<Share size={22} />} 
            label="Share via..." 
            onClick={handleSystemShare} 
          />


        </div>
      </div>
    </div>
  );
}

// Sub-component for individual options to keep code clean
function ShareOption({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors group"
    >
      <div className="text-gray-900 dark:text-white group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <span className="font-semibold text-[16px] text-gray-900 dark:text-white">
        {label}
      </span>
    </button>
  );
}