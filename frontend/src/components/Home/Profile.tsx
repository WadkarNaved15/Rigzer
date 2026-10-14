import { useState, useRef } from "react";
import { useAccountSwitcherContext } from "../../context/AccountSwitcherContext";
import { useNavigate } from "react-router-dom";
import { CircleUser, Bookmark, LogIn, LogOut, Bell, User } from "lucide-react";
import AccountSwitcherOverlay from "./AccountSwitchOverlay";
import { useUser } from "../../context/user";
import { useNotification } from "../../context/Notifications";

interface ProfileCoverProps {
  onOpenWishlist: () => void;
  isToggled: boolean;
  onToggle: () => void;
}

function SciFiFrame() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none z-50"
      viewBox="0 0 400 450"
      preserveAspectRatio="none"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <style>
        {`
          .draw-path {
            stroke-dasharray: 2500;
            stroke-dashoffset: 2500;
            /* Slowed down from 1.5s to 4s for a long, scanning draw effect */
            animation: drawLine 4s cubic-bezier(0.25, 1, 0.5, 1) forwards;
          }
          
          .power-up {
            opacity: 0;
            /* Extended duration to 2.5s and delayed to 3.8s to wait for the slow draw */
            animation: flickerOn 2.5s ease-out 3.8s forwards;
          }

          @keyframes drawLine {
            to { stroke-dashoffset: 0; }
          }

          /* A longer, more complex flickering boot sequence */
          @keyframes flickerOn {
            0% { opacity: 0; }
            5% { opacity: 0.6; }
            10% { opacity: 0; }
            15% { opacity: 0.8; }
            25% { opacity: 0.1; }
            40% { opacity: 0.9; }
            50% { opacity: 0.3; }
            65% { opacity: 1; }
            75% { opacity: 0.6; }
            85% { opacity: 1; }
            90% { opacity: 0.8; }
            100% { opacity: 1; }
          }
        `}
      </style>

      <defs>
        {/* Intense Neon Glow for Accents */}
        <filter id="neonGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur1" />
          <feGaussianBlur stdDeviation="10" result="blur2" />
          <feMerge>
            <feMergeNode in="blur2" />
            <feMergeNode in="blur1" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Ambient Glow for Outer Borders */}
        <filter id="subtleGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* 3D Metallic Gradients */}
        <linearGradient id="metalBase" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="50%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#020617" />
        </linearGradient>

        <linearGradient id="metalBevelOuter" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#475569" />
          <stop offset="20%" stopColor="#1e293b" />
          <stop offset="80%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#334155" />
        </linearGradient>

        <linearGradient id="metalHighlight" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="15%" stopColor="#94a3b8" />
          <stop offset="50%" stopColor="#334155" />
          <stop offset="85%" stopColor="#64748b" />
          <stop offset="100%" stopColor="#e2e8f0" />
        </linearGradient>

        {/* Core Geometry Path */}
        <path
          id="coreFrame"
          d="
            M 34 10
            H 110
            L 130 30
            H 270
            L 290 10
            H 366
            A 24 24 0 0 1 390 34
            V 416
            A 24 24 0 0 1 366 440
            H 34
            A 24 24 0 0 1 10 416
            V 34
            A 24 24 0 0 1 34 10
            Z
          "
        />
      </defs>

      {/* ======================= */}
      {/* BASE STRUCTURE (Draws in slowly) */}
      {/* ======================= */}

      {/* 1. Outer Cyan Ambient Glow Box */}
      <rect
        className="draw-path"
        x="3"
        y="3"
        width="394"
        height="444"
        rx="27"
        stroke="#0ea5e9"
        strokeWidth="1.5"
        filter="url(#subtleGlow)"
        opacity="0.3"
        vectorEffect="non-scaling-stroke"
      />

      {/* 2. Base Drop Shadow / Outer Dark Casing */}
      <use
        className="draw-path"
        href="#coreFrame"
        stroke="#000000"
        strokeWidth="18"
        opacity="0.6"
        vectorEffect="non-scaling-stroke"
      />

      {/* 3. Thick Metal Casing (Base Layer) */}
      <use
        className="draw-path"
        href="#coreFrame"
        stroke="url(#metalBase)"
        strokeWidth="16"
        vectorEffect="non-scaling-stroke"
      />

      {/* 4. Bevel Slope (Mid Layer for Depth) */}
      <use
        className="draw-path"
        href="#coreFrame"
        stroke="url(#metalBevelOuter)"
        strokeWidth="10"
        vectorEffect="non-scaling-stroke"
      />

      {/* 5. Sharp Inner Metallic Ridge (Highlight Layer) */}
      <use
        className="draw-path"
        href="#coreFrame"
        stroke="url(#metalHighlight)"
        strokeWidth="2.5"
        vectorEffect="non-scaling-stroke"
      />

      {/* 5.5 Top Bridging Wire (completes the square over the cutout) */}
      <path
        className="draw-path"
        d="M 110 10 H 290"
        stroke="url(#metalBase)"
        strokeWidth="4"
        vectorEffect="non-scaling-stroke"
      />
      <path
        className="draw-path"
        d="M 110 10 H 290"
        stroke="url(#metalHighlight)"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />

      {/* 6. Deep Inner Shadow (Simulates the drop-off to the content) */}
      <path
        className="draw-path"
        d="
          M 36 18
          H 107
          L 127 38
          H 273
          L 293 18
          H 364
          A 18 18 0 0 1 382 36
          V 414
          A 18 18 0 0 1 364 432
          H 36
          A 18 18 0 0 1 18 414
          V 36
          A 18 18 0 0 1 36 18
          Z
        "
        stroke="#020617"
        strokeWidth="4"
        opacity="0.8"
        vectorEffect="non-scaling-stroke"
      />

      {/* ======================= */}
      {/* HUD & NEON (Powers up after drawing) */}
      {/* ======================= */}
      <g className="power-up">
        
        {/* Top Outer Rim Edge Highlight */}
        <path
          d="M 10 40 A 24 24 0 0 1 34 10 H 110"
          stroke="#0ea5e9"
          strokeWidth="1.5"
          filter="url(#subtleGlow)"
          opacity="0.7"
          vectorEffect="non-scaling-stroke"
          fill="none"
        />
        <path
          d="M 290 10 H 366 A 24 24 0 0 1 390 40"
          stroke="#0ea5e9"
          strokeWidth="1.5"
          filter="url(#subtleGlow)"
          opacity="0.7"
          vectorEffect="non-scaling-stroke"
          fill="none"
        />

        {/* Recessed Center Slit Glow */}
        <path
          d="M 140 28 H 260"
          stroke="#22d3ee"
          strokeWidth="4"
          filter="url(#neonGlow)"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M 155 28 H 245"
          stroke="#ffffff"
          strokeWidth="1.5"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* Top Left Decorative HUD Lines */}
        <g stroke="#0ea5e9" strokeWidth="1.5" fill="none" opacity="0.8" vectorEffect="non-scaling-stroke">
          <rect x="50" y="24" width="8" height="8" />
          <path d="M 64 24 V 44" />
        </g>

        {/* Subtle Side Cyber-Accents (Left & Right) */}
        <path
          d="M 10 150 V 220"
          stroke="#0ea5e9"
          strokeWidth="2"
          filter="url(#subtleGlow)"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M 10 150 V 220"
          stroke="#ffffff"
          strokeWidth="1"
          opacity="0.8"
          vectorEffect="non-scaling-stroke"
        />

        <path
          d="M 390 150 V 220"
          stroke="#0ea5e9"
          strokeWidth="2"
          filter="url(#subtleGlow)"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M 390 150 V 220"
          stroke="#ffffff"
          strokeWidth="1"
          opacity="0.8"
          vectorEffect="non-scaling-stroke"
        />

        {/* Bottom Stabilization Glow */}
        <path
          d="M 160 440 H 240"
          stroke="#0ea5e9"
          strokeWidth="2"
          filter="url(#subtleGlow)"
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}


export default function ProfileCover({ onOpenWishlist, isToggled, onToggle }: ProfileCoverProps) {
  const [bioExpanded, setBioExpanded] = useState(false);
  const navigate = useNavigate();
  const { unreadCount } = useNotification();
  const { user, logout } = useUser();

  const userBio = user?.bio || "Bio goes here...";
  const isBioLong = userBio.length > 40;
  const avatarRef = useRef<HTMLImageElement>(null);
  const {
    isOpen: accountOverlayOpen,
    anchorRect,
    openAccountSwitcher,
    closeAccountSwitcher,
  } = useAccountSwitcherContext();

  // If user is NOT logged in → Show login prompt card
  if (!user) {
    return (
      <div className="max-w-3xl mx-auto">
        <div
          className="
            relative overflow-visible
            rounded-t-[0.5rem]
            bg-gradient-to-br
            from-white/[0.08]
            via-white/[0.04]
            to-white/[0.01]
            border border-white/10
            shadow-[0_8px_32px_rgba(0,0,0,0.45)]
            shadow-white/[0.02]
            transition-all duration-300
            before:absolute
            before:inset-0
            before:rounded-t-[0.5rem]
            before:pointer-events-none
            before:bg-gradient-to-b
            before:from-white/[0.12]
            before:via-white/[0.03]
            before:to-transparent
            "
        >
          <div
            className="
              absolute inset-0
              rounded-t-[0.5rem]
              pointer-events-none
              bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.04),transparent_45%)]
            "
          />

          <div
            className="
              absolute
              top-0
              left-1/2
              -translate-x-1/2
              h-24
              w-40
              bg-white/[0.05]
              rounded-full
              blur-3xl
              pointer-events-none
            "
          />
          {/* Content */}
          <div className="px-4 pt-5 pb-5 text-center relative z-10">
            {/* Avatar */}
            <div className="mx-auto w-14 h-14 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center mb-3">
              <User className="h-8 w-8 text-gray-400 dark:text-gray-500" />
            </div>

            <h4 className="text-base font-bold text-gray-900 dark:text-gray-100">
              Welcome to Rigzer
            </h4>

            <p className="text-gray-400 text-sm mt-1">
              Login to access further services
            </p>

            {/* Action */}
            <div className="flex justify-center mt-4 relative z-20">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  navigate("/auth");
                }}
                className="
                inline-flex items-center gap-2
                px-4 py-1.5 rounded-full
                bg-blue-600 hover:bg-blue-700
                text-white text-xs font-medium
                transition-all active:scale-95
              "
              >
                <User className="h-4 w-4" />
                Login / Sign Up
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Dynamic values to match your schema
  const bannerUrl = user?.banner || "/Rigzer_Banner.jpeg";

  const handleAvatarClick = (e: React.MouseEvent<HTMLImageElement>) => {
    // Prevent outer containers from hijacking the click
    e.preventDefault();
    e.stopPropagation();

    // Ensure user has a username before routing
    if (user.username) {
      navigate(`/profile/${user.username}`);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">

      <div
        className="
          relative overflow-hidden
          rounded-xl
          bg-white/[0.04]
          backdrop-blur-xl
          backdrop-saturate-150
          border border-white/10
          shadow-[0_8px_32px_rgba(0,0,0,0.45)]
          shadow-white/[0.02]
          transition-all duration-300
          before:absolute
          before:inset-0
          before:pointer-events-none
          before:bg-gradient-to-b
          before:from-white/[0.08]
          before:via-transparent
          before:to-transparent
        "
      >
        {isToggled && <SciFiFrame />}
        <div
          className="
            absolute
            top-0
            left-0
            w-full
            h-px
            bg-gradient-to-r
            from-transparent
            via-white/30
            to-transparent
            z-20
            pointer-events-none
          "
        />
        {/* Cover Image for profile */}
        <div className="relative rounded-t-[0.5rem]">
          <div
            className="w-full h-20 bg-cover bg-center rounded-t-[0.5rem]"
            style={{
              backgroundImage: `url(${bannerUrl})`,
              filter: "brightness(0.8) saturate(1.2)",
            }}
          />
          {/* Gradient Overlay - Adjusts based on mode */}
          <div
            className="
          absolute inset-0
          bg-gradient-to-b
          from-white/[0.02]
          via-black/10
          to-[#1e1e1e]
          pointer-events-none
        "
          />

          {/* Profile Image Container */}
          <div className="absolute -bottom-8 left-4 flex items-end z-30">
            <div className="relative">
              <img
                ref={avatarRef}
                src={user?.avatar || "/default_avatar.png"}
                alt="Profile"
                onClick={handleAvatarClick}
                className={`
                  w-16 h-16
                  rounded-full
                  object-cover
                  cursor-pointer
                  border border-white/20
                  bg-white/[0.08]
                  shadow-[0_0_0_1px_rgba(255,255,255,0.08)]
                  shadow-[0_0_25px_rgba(255,255,255,0.10)]
                  hover:brightness-95
                  hover:scale-105
                  transition-all duration-300
                  relative z-30
                  ${accountOverlayOpen ? "opacity-0 pointer-events-none" : "opacity-100"}
                `}
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="mt-10 px-4 pb-8 flex items-center justify-between w-full relative z-10">
          {/* User Info (Left Side) */}
          <div className="flex flex-col items-start">
            {/* Display Name */}
            <h4 className="text-md font-bold text-gray-900 dark:text-gray-100 leading-tight">
              {user?.displayName || user?.username || ""}
            </h4>

            {/* Username Handle */}
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-0.5 lowercase">
              @{user?.username?.replace(/\s+/g, "") || ""}
            </p>
          </div>

          {/* Vertical Transparent Toggle Button (Right Side) */}
          {/* <button
            type="button"
            role="switch"
            aria-checked={isToggled}
            onClick={onToggle}
            className={`
              relative w-6 h-12 rounded-full p-1
              border border-white/20
              transition-colors duration-300 ease-in-out
              flex flex-col justify-between items-center
              focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30
          `}
          >
            <span
              className={`
                w-4 h-4 rounded-full shadow-md
                transition-all duration-300 ease-in-out
                ${isToggled
                  ? "translate-y-[20px] bg-blue-500 shadow-blue-500/50"
                  : "translate-y-0 bg-white"
                }
              `}
            />
          </button> */}
        </div>


        {accountOverlayOpen && (
          <AccountSwitcherOverlay
            anchorRect={anchorRect}
            onClose={closeAccountSwitcher}
          />
        )}
      </div>
    </div>
  );
}