import { createPortal } from "react-dom";
import { X, Plus, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
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
    .filter((acc: Account) => acc.userId !== user?._id); // hide active account

  const handleSwitch = async (userId: string) => {
    onClose(); 
    await switchAccount(userId);
  };
  // Positioning logic
  const style: React.CSSProperties = {
    position: "fixed",
    top: anchorRect.top,
    left: anchorRect.right + 12,
    zIndex: 9999,
  };

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[9998] bg-black/20 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* MENU CARD */}
      <div
        style={style}
        className="w-64 rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10
                   bg-white dark:bg-[#191919] 
                   animate-in fade-in slide-in-from-left-2 duration-200"
      >
        <div className="p-3">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-sm font-bold text-gray-900 dark:text-white">Accounts</span>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full">
              <X size={16} className="text-gray-500" />
            </button>
          </div>

          <div className="space-y-1">
            {allAccounts.map((acc) => (
              <button
                key={acc.userId}
                onClick={() => handleSwitch(acc.userId)}
                className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={acc.avatar || "/default-avatar.png"}
                    className="w-10 h-10 rounded-full object-cover border border-gray-100 dark:border-white/5"
                    alt={acc.username}
                  />
                  <div className="text-left">
                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate w-24">
                      {acc.username}
                    </p>
                    <p className="text-xs text-gray-500">@{acc.username.toLowerCase()}</p>
                  </div>
                </div>
                {acc.userId === user?._id && (
                  <Check size={18} className="text-blue-500" />
                )}
              </button>
            ))}

            <button
              onClick={() => navigate("/auth?add=true")}
              className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors mt-2 border-t border-gray-100 dark:border-white/5 pt-3"
            >
              <div className="w-10 h-10 rounded-full border border-dashed border-gray-300 dark:border-white/20 flex items-center justify-center">
                <Plus size={20} className="text-gray-600 dark:text-gray-400" />
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-white text-left leading-tight">
                Add an existing account
              </span>
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}