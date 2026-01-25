import { createPortal } from "react-dom";
import { Plus, LogOut, LogIn } from "lucide-react";
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

export default function AccountSwitcherOverlay({ 
  onClose, 
  anchorRect 
}: AccountSwitcherOverlayProps) {
  const navigate = useNavigate();
  const { user, logout } = useUser();
  const { switchAccount } = useAccountSwitch();
  
  if (!anchorRect) return null;

  const allAccounts: Account[] = JSON.parse(localStorage.getItem("accounts") || "[]")
    .filter((acc: Account) => acc.userId !== user?._id);

  // Configuration for the vertical connection
  const centerX = anchorRect.left + anchorRect.width / 2;
  const startY = anchorRect.bottom;
  const LINE_DROP = 120; // How far down the line goes
  const endY = startY + LINE_DROP;

  return createPortal(
    <>
      {/* 1. Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* 2. Straight Vertical Line */}
      <svg className="fixed inset-0 w-full h-full pointer-events-none z-[101] overflow-visible">
        <line
          x1={centerX}
          y1={startY}
          x2={centerX}
          y2={endY}
          stroke="rgba(255, 255, 255, 0.4)"
          strokeWidth="2"
          strokeDasharray="4 4"
        />
      </svg>

      {/* 3. Logout Icon at the end of the straight line */}
      <div 
        style={{
          position: "fixed",
          top: endY,
          left: centerX - 20, // Center the 40px wide div
          width: 40,
          height: 40,
          zIndex: 102,
        }}
        className="flex items-center justify-center rounded-full bg-white/10 border border-white/20 text-white shadow-xl backdrop-blur-sm cursor-pointer hover:bg-white/20 transition-all"
        onClick={() => {
            logout();
            onClose();
        }}
      >
        {user ? <LogOut size={20} /> : <LogIn size={20} />}
      </div>

      {/* 4. Active Profile Image */}
      <div 
        style={{
          position: "fixed",
          top: anchorRect.top,
          left: anchorRect.left,
          width: anchorRect.width,
          height: anchorRect.height,
          zIndex: 102,
        }}
      >
        <img
          src={user?.avatar || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"}
          className="w-full h-full rounded-full border-4 border-[#191919] shadow-2xl object-cover cursor-pointer"
          onClick={onClose}
          alt="Active Profile"
        />
      </div>

      {/* 5. Account Selection Row */}
      <div
        style={{
          position: "fixed",
          top: anchorRect.top + 6, 
          left: anchorRect.right + 20,
          zIndex: 102,
        }}
        className="flex items-start gap-4 animate-in fade-in slide-in-from-left-4 duration-300"
      >
        {allAccounts.map((acc) => (
          <button
            key={acc.userId}
            onClick={() => {
              onClose();
              switchAccount(acc.userId);
            }}
            className="group flex flex-col items-center gap-2 transition-transform active:scale-95"
          >
            <img
              src={acc.avatar || "https://images.unsplash.com/photo-1494790108377-be9c29b29330"}
              className="w-14 h-14 rounded-full object-cover border-2 border-white/20 group-hover:border-white/60 shadow-lg transition-all"
              alt={acc.username}
            />
            <span className="text-[10px] font-bold text-white truncate max-w-[70px]">
              {acc.username}
            </span>
          </button>
        ))}

        <button
          onClick={() => navigate("/auth?add=true")}
          className="flex flex-col items-center gap-2 group transition-transform active:scale-95"
        >
          <div className="w-14 h-14 rounded-full border-2 border-dashed border-white/30 flex items-center justify-center bg-white/5 group-hover:bg-white/10 group-hover:border-white/50 transition-all">
            <Plus size={20} className="text-white" />
          </div>
          <span className="text-[10px] font-medium text-white/70">Add</span>
        </button>
      </div>
    </>,
    document.body
  );
}