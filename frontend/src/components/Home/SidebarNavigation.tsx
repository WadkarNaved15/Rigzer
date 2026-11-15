import {
    CircleUser,
    Bell,
    Bookmark,
    LogOut,
    LogIn,
    Home,
    Settings,
    ChevronDown,
    Key,
    Trash2
} from "lucide-react";
import { useState, useRef } from "react";
import { useAccountSwitcherContext } from "../../context/AccountSwitcherContext";
import { useNavigate, useLocation } from "react-router-dom";
import { useUser } from "../../context/user";
import { useNotification } from "../../context/Notifications";

interface Props {
    onOpenWishlist: () => void;
    onOpenSettings: (view: 'password' | 'delete') => void;
}

type NavItem = {
    icon: React.ElementType;
    label: string;
    path: string;
    activePath: string;
    action: () => void;
    isExpandable?: boolean;
    isExpanded?: boolean;
    subItems?: Array<{
        icon: React.ElementType;
        label: string;
        action: () => void;
        isDanger?: boolean;
    }>;
};

export default function SidebarNavigation({
    onOpenWishlist,
    onOpenSettings,
}: Props) {
    const navigate = useNavigate();
    const location = useLocation();

    const { user, logout } = useUser();
    const { unreadCount } = useNotification();

    const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);
    const logoutButtonRef = useRef<HTMLButtonElement>(null);

    const { openAccountSwitcher } = useAccountSwitcherContext();

    const handleAccountSwitcher = () => {
        let accounts: Array<{ userId: string }> = [];

        try {
            const stored = JSON.parse(
                localStorage.getItem("accounts") || "[]"
            );

            accounts = Array.isArray(stored) ? stored : [];
        } catch {
            accounts = [];
        }

        // No saved accounts at all
        if (accounts.length === 0) {
            navigate("/auth");
            return;
        }

        // At least one account exists: open the switcher
        if (logoutButtonRef.current) {
            openAccountSwitcher(
                logoutButtonRef.current.getBoundingClientRect()
            );
        }
    };

    const hasSavedAccounts = (() => {
        try {
            const accounts = JSON.parse(
                localStorage.getItem("accounts") || "[]"
            );

            return (
                Array.isArray(accounts) &&
                accounts.some((account) => account?.userId)
            );
        } catch {
            return false;
        }
    })();

    const items: NavItem[] = [
        {
            icon: Home,
            label: "Home",
            path: "/",
            activePath: "/",
            action: () => navigate("/"),
        },
        {
            icon: CircleUser,
            label: "Profile",
            path: `/profile/${user?.username}`,
            activePath: "/profile",
            action: () => navigate(`/profile/${user?.username}`),
        },
        {
            icon: Bell,
            label: "Notifications",
            path: "/notifications",
            activePath: "/notifications",
            action: () => navigate("/notifications"),
        },
        {
            icon: Bookmark,
            label: "Saved",
            path: "/wishlist",
            activePath: "/wishlist",
            action: onOpenWishlist,
        },
        {
            icon: Settings,
            label: "Settings",
            path: "/settings",
            activePath: "/settings",
            isExpandable: true,
            isExpanded: isSettingsExpanded,
            action: () => setIsSettingsExpanded(!isSettingsExpanded),
            subItems: [
                // Only authenticated non-Google users can change password
                ...(user && !user.isGoogleUser
                    ? [{
                        icon: Key,
                        label: "Change Password",
                        action: () => onOpenSettings("password"),
                    }]
                    : []),

                // Always visible for authenticated users and guests
                {
                    icon: user ? LogOut : LogIn,
                    label: user ? "Logout/Switch Account" : "Login/Switch Account",
                    action: handleAccountSwitcher,
                },

                // Only authenticated users can delete their account
                ...(user
                    ? [{
                        icon: Trash2,
                        label: "Delete Account",
                        action: () => onOpenSettings("delete"),
                        isDanger: true,
                    }]
                    : []),
            ],
        },
    ];


    return (
        <nav className="flex flex-col gap-1">
            {items.map((item) => {
                const active =
                    item.activePath === "/"
                        ? location.pathname === "/"
                        : location.pathname.startsWith(item.activePath);

                return (
                    <div key={item.label} className="flex flex-col">
                        <button
                            onClick={item.action}
                            className={`
                                relative flex items-center justify-between
                                px-4 py-3 rounded-lg transition-all
                                ${active && !item.isExpandable
                                    ? "bg-white/10 text-white border-l-2 border-[#62D4AE]"
                                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                                }
                            `}
                        >
                            <div className="flex items-center gap-3">
                                <item.icon size={18} />
                                <span className="text-sm font-medium">
                                    {item.label}
                                </span>
                            </div>

                            {item.label === "Notifications" && unreadCount > 0 && (
                                <span className="ml-auto min-w-[20px] h-5 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-xs">
                                    {unreadCount}
                                </span>
                            )}

                            {item.isExpandable && (
                                <ChevronDown
                                    size={16}
                                    className={`transition-transform duration-200 ${item.isExpanded ? "rotate-180" : ""}`}
                                />
                            )}
                        </button>

                        {item.isExpandable && (
                            <div
                                className={`
                                    overflow-hidden transition-all duration-300 ease-in-out
                                    ${item.isExpanded ? "max-h-40 opacity-100 mt-1" : "max-h-0 opacity-0"}
                                `}
                            >
                                <div className="flex flex-col gap-1 pl-10 pr-2 pb-1">
                                    {item.subItems?.map((sub) => (
                                        <button
                                            key={sub.label}
                                            // Fixed the label check here so the ref attaches properly
                                            ref={
                                                sub.label === "Logout/Switch Account" ||
                                                sub.label === "Login/Switch Account"
                                                    ? logoutButtonRef
                                                    : undefined
                                            }
                                            onClick={sub.action}
                                            // Added text-left and leading-tight to fix wrapping, items-start to keep icon at the top
                                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left leading-tight text-gray-400 hover:bg-white/5 transition-all text-sm font-medium ${sub.isDanger ? 'hover:text-red-500' : 'hover:text-[#62D4AE]'
                                                }`}
                                        >
                                            {/* Shrink-0 prevents the icon from squishing when text wraps */}
                                            <div className="shrink-0 mt-[2px]">
                                                <sub.icon size={16} />
                                            </div>
                                            <span>{sub.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </nav>
    );
}