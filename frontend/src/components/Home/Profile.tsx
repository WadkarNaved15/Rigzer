import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircleUser, Bookmark, LogIn, LogOut, Bell } from "lucide-react";
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
  
  const navigate = useNavigate();
  const { unreadCount } = useNotification();
  const { user, logout } = useUser();

  // Dynamic values to match your schema
  const bannerUrl = user?.banner || 'https://fastly.picsum.photos/id/299/800/200.jpg?hmac=xMdRbjiNM_IogJDEgKIJ0GeCxZ8nwOGd5_Wf_ODZ94s';
  
  const handleAvatarClick = (e: React.MouseEvent<HTMLImageElement>) => {
    setAnchorRect(e.currentTarget.getBoundingClientRect());
    setAccountOverlayOpen(true);
  };

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
        className="
          relative overflow-visible shadow-sm transition-colors duration-200
          border-[2px] border-[#E0E0E5] dark:border-gray-700 
          bg-[#F9FAFB] dark:bg-[#191919] 
          rounded-t-[0.5rem]
        "
      >
        {/* Cover Image */}
        <div className="relative overflow-hidden rounded-t-[0.5rem]">
          <div
            className="w-full h-20 bg-cover bg-center"
            style={{ backgroundImage: `url(${bannerUrl})` }}
          />
          {/* Gradient Overlay - Adjusts based on mode */}
          <div
            className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#F9FAFB] dark:to-[#191919]"
          />

          {/* Profile Image Container */}
          <div className="absolute -bottom-8 left-4 flex items-end z-10">
            <div className="relative">
              <img
                src={user?.avatar || "/default_avatar.png"}
                alt="Profile"
                onClick={handleAvatarClick}
                className={`
                  w-16 h-16 rounded-full border-4 shadow-xl object-cover cursor-pointer 
                  hover:brightness-90 transition-all
                  border-[#F9FAFB] dark:border-[#191919]
                  ${accountOverlayOpen ? "opacity-0" : "opacity-100"}
                `}
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="mt-10 px-4">
          <h4 className="text-md font-bold text-gray-900 dark:text-gray-100">
            {user?.username || "John Developer"}
          </h4>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {user?.bio || "Game Developer"}
          </p>
        </div>

        {/* Navigation Buttons */}
        <div className="flex mt-4 pb-4 items-center justify-center space-x-2">
          {navItems.map((item, idx) => (
            <button
              key={idx}
              onClick={item.action}
              title={item.label}
              className="
                p-2 rounded-full transition-all active:scale-90 group relative
                hover:bg-gray-200 dark:hover:bg-white/10 
              "
            >
              <item.icon className="h-5 w-5 text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white transition-colors" />
              
              {/* Notification Badge */}
              {item.label === "Notifications" && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 min-w-[16px] px-1 
                  flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold border-2 border-[#F9FAFB] dark:border-[#191919]">
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