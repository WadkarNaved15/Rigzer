import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { CircleUser, Gamepad2, Bookmark, LogIn, LogOut, Bell } from "lucide-react";
import AccountSwitcherOverlay from "./AccountSwitchOverlay";
import { useUser } from "../../context/user";
import { useNotification } from "../../context/Notifications";
interface ProfileCoverProps {
  setProfileOpen: (open: boolean) => void;
  onOpenWishlist: () => void;
}

export default function ProfileCover({
  setProfileOpen,
  onOpenWishlist,
}: ProfileCoverProps) {
  const [accountOverlayOpen, setAccountOverlayOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const cardBg = "#191919";
  const navigate = useNavigate();
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
  const { unreadCount } = useNotification()
  const { user, logout } = useUser();
  const bannerUrl = user?.banner || 'https://fastly.picsum.photos/id/299/800/200.jpg?hmac=xMdRbjiNM_IogJDEgKIJ0GeCxZ8nwOGd5_Wf_ODZ94s';
  const handleAvatarClick = (e: React.MouseEvent<HTMLImageElement>) => {
    setAnchorRect(e.currentTarget.getBoundingClientRect());
    setAccountOverlayOpen(true);
  };
  console.log("bannerUrl", bannerUrl)
  const navItems = [
    { icon: CircleUser, label: "Profile", action: () => setProfileOpen(true) },
    { icon: Bell, label: "Notifications", action: () => navigate("/notifications") },
    { icon: Bookmark, label: "Saved", action: onOpenWishlist },
    user
      ? { icon: LogOut, label: "Logout", action: logout }
      : { icon: LogIn, label: "Login", action: () => navigate("/auth") },
  ];

  return (
    <div className="max-w-3xl mx-auto">
      <div
        className="relative backdrop-blur-sm border border-white/5 rounded-t-[0.5rem] overflow-visible shadow-xl"
        style={{ backgroundColor: cardBg }}
      >
        {/* Cover */}
        <div className="relative">
          <div
            className="w-full h-16 bg-cover bg-center"
            style={{
              backgroundImage:
                `url(${bannerUrl})`
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(180deg, transparent 0%, rgba(25, 25, 25, 0.2) 30%, rgba(25, 25, 25, 0.7) 60%, ${cardBg} 100%)`,
            }}
          />

          {/* Profile Image Container */}
          <div className="absolute -bottom-8 left-4 flex items-end z-10">
            <div className="relative">
              <img
                src={user?.avatar || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"}
                alt="Profile"
                onClick={handleAvatarClick}
                className={`w-16 h-16 rounded-full border-4 shadow-2xl object-cover cursor-pointer hover:brightness-90 transition-all ${accountOverlayOpen ? "opacity-0" : "opacity-100"
                  }`}
                style={{ borderColor: cardBg }}
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="mt-10 px-4">
          <h4 className="text-md font-bold text-gray-100">{user?.username || "John Developer"}</h4>
          <p className="text-gray-500 text-sm">Game Developer</p>
        </div>

        {/* Nav Buttons */}
        <div className="flex mt-4 pb-4 items-center justify-center space-x-2">
          {navItems.map((item, idx) => (
            <button
              key={idx}
              onClick={item.action}
              title={item.label}
              className="p-2 rounded-full hover:bg-white/10 transition-all active:scale-90 group relative"
            >
              <item.icon className="h-5 w-5 text-gray-400 group-hover:text-white transition-colors" />
              {/* 🔥 Unread Badge Logic */}
              {item.label === "Notifications" && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 
          flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {accountOverlayOpen && (
          <AccountSwitcherOverlay
            anchorRect={anchorRect}
            onClose={() => setAccountOverlayOpen(false)}
          />
        )}
      </div>
    </div>
  );
}