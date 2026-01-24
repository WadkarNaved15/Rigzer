import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../../context/user";
import { useAccountSwitch } from "../../hooks/useAccountSwitch";

interface Account {
  userId: string;
  username: string;
  avatar?: string;
}

interface AccountSwitcherOverlayProps {
  onClose: () => void;
  anchorRect: DOMRect | null;
}

export default function AccountSwitcherOverlay({ onClose, anchorRect }: AccountSwitcherOverlayProps) {
  const navigate = useNavigate();
  const { user } = useUser();
  const { switchAccount } = useAccountSwitch();
  
  if (!anchorRect) return null;

  const allAccounts: Account[] = JSON.parse(localStorage.getItem("accounts") || "[]")
    .filter((acc: Account) => acc.userId !== user?._id);

  const handleSwitch = async (userId: string) => {
    onClose(); 
    await switchAccount(userId);
  };

  const style: React.CSSProperties = {
    position: "fixed",
    // Aligns the row to the middle of your main profile pic
    top: anchorRect.top+6, 
    left: anchorRect.right + 16,
    zIndex: 9999,
  };

  return createPortal(
    <>
      {/* Backdrop - lowered opacity to keep focus on the row */}
      <div
        className="fixed inset-0 z-[9998] bg-black/10 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* HORIZONTAL ACCOUNTS ROW */}
      <div
        style={style}
        className="flex items-start gap-4 animate-in fade-in slide-in-from-left-4 duration-300"
      >
        {allAccounts.map((acc) => (
          <button
            key={acc.userId}
            onClick={() => handleSwitch(acc.userId)}
            className="group flex flex-col items-center gap-2 transition-transform active:scale-95"
          >
            <div className="relative">
              <img
                src={acc.avatar || "https://images.unsplash.com/photo-1494790108377-be9c29b29330"}
                className="w-14 h-14 rounded-full object-cover border-2 border-white/20 group-hover:border-white/50 shadow-lg transition-all"
                alt={acc.username}
              />
            </div>
            <span className="text-[10px] font-medium text-white bg-black/40 px-2 py-0.5 rounded-full backdrop-blur-md truncate max-w-[70px]">
              {acc.username}
            </span>
          </button>
        ))}

        {/* Add Account Button */}
        <button
          onClick={() => navigate("/auth?add=true")}
          className="flex flex-col items-center gap-2 group transition-transform active:scale-95"
        >
          <div className="w-14 h-14 rounded-full border-2 border-dashed border-white/30 flex items-center justify-center bg-white/5 group-hover:bg-white/10 group-hover:border-white/50 transition-all">
            <Plus size={20} className="text-white/70" />
          </div>
          <span className="text-[10px] font-medium text-white/70">Add</span>
        </button>
      </div>
    </>,
    document.body
  );
}