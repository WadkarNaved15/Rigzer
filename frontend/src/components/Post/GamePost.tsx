import React, { useMemo, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Play, Gamepad2, Sparkles, Loader2, AlertCircle, 
  Users, VolumeX, Volume2, Clock, Check, X, CreditCard,
  Ban, ShieldAlert , BellRing , BellPlus, PlusCircle
} from 'lucide-react';
import { useQueue } from '../../context/QueueContext';
import { useUI } from '../../context/UIContext';
import { useLikes } from '../../hooks/useLikes';
import { useWishlist } from '../../hooks/useWishlist';
import ConfirmDeleteModal from '../Home/ConfirmDeleteModal';
import { useUser } from "../../context/user";
import PostHeader from './PostHeader';
import PostInteractions from './PostInteractions';
import { toast } from "react-toastify";
import { getStreamEligibility } from "../../utils/streamEligibility";
import type { StreamEligibility } from "../../utils/streamEligibility";
import { trackEvent } from "../../utils/analytics";
import { useAudio } from "../../context/AudioContext";
import { loadRazorpay } from "../../utils/loadRazorpay";

const renderTextWithLinks = (text: string) => {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  
  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()} // Prevents the post from opening when clicking the link
          className="text-[rgb(98,212,174)] hover:text-[rgb(78,192,154)] hover:underline break-words"
        >
          {part}
        </a>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
};

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

// ─── TYPES ──────────────────────────────────────────────────────────────────
interface GamePostProps {
  user: any;
  description: string;
  createdAt: string;
  viewsCount?: number;
  uniqueViewsCount?: number;
  commentsCount: number;
  likesCount: number;
  isLiked: boolean;
  isWishlisted: boolean;
  onOpenDetails: () => void;
  onDeleteSuccess: (postId: string) => void;
  disableInteractions: boolean;
  _id: string;
  gamePost: any;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

// ─── SUB-COMPONENTS ─────────────────────────────────────────────────────────

const RepurchaseModal = ({
  isOpen,
  onClose,
  postId,
  maxSessionDuration,
  gameName,
  currentUser,
  onSuccess
}: {
  isOpen: boolean,
  onClose: () => void,
  postId: string,
  maxSessionDuration: number,
  gameName: string,
  currentUser: any,
  onSuccess: (addedCredits: number) => void
}) => {
  const [dollars, setDollars] = useState<number>(100);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const selectedCredits = (dollars || 0) * 40;
  const sessionsAdded = Math.floor(selectedCredits / maxSessionDuration);
  const price = dollars || 0;

  if (!isOpen) return null;

  const handlePayment = async () => {
    if (dollars < 100 || dollars > 5000) {
      toast.error("Please enter an amount between $100 and $5000.");
      return;
    }

    setIsProcessing(true);
    try {
      const orderRes = await fetch(`${BACKEND_URL}/api/gamePosts/${postId}/create-repurchase-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: "include",
        body: JSON.stringify({ selectedCredits })
      });
      
      if (!orderRes.ok) throw new Error("Failed to create order");
      const order = await orderRes.json();

      await loadRazorpay();

      if (!window.Razorpay) {
        throw new Error("Failed to load Razorpay SDK");
      }

      const options = {
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,

        name: "Rigzer",
        image: "/Logo.png",

        description: `${selectedCredits} Credits — ${gameName}`,

        order_id: order.orderId,

        prefill: {
          name: currentUser?.username || "",
          email: currentUser?.email || "",
        },

        theme: {
          color: "#3D7A6E",
        },

        handler: async (response: any) => {
          try {
            const verifyRes = await fetch(
              `${BACKEND_URL}/api/gamePosts/${postId}/verify-repurchase-payment`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                credentials: "include",
                body: JSON.stringify({
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                  selectedCredits,
                }),
              }
            );

            if (!verifyRes.ok) {
              throw new Error("Verification failed");
            }

            toast.success("Sessions repurchased successfully!");
            setIsProcessing(false);
            onSuccess(selectedCredits);
            onClose();
          } catch (err) {
            console.error(err);
            setIsProcessing(false);
            toast.error(
              "Payment verification failed. Please contact support."
            );
          }
        },

        modal: {
          ondismiss: () => {
            setIsProcessing(false);
            toast.info("Payment cancelled");
          },
        },
      };

      // @ts-ignore
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response: any){
        setIsProcessing(false);
        toast.error(response.error.description || "Payment failed");
      });
      rzp.open();

    } catch (err) {
      console.error(err);
      toast.error("Unable to initiate payment");
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity">
      <div 
        role="dialog" 
        aria-modal="true"
        className="bg-[#121212] border border-white/10 rounded-3xl p-6 w-full max-w-md shadow-2xl relative overflow-hidden"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <CreditCard size={20} className="text-white" />
            Repurchase Credits
          </h2>
          <button onClick={onClose} disabled={isProcessing} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-gray-400 mb-6">
          1 Dollar = 40 Credits. 1 Credit = 1 Minute. Estimated sessions depend on your demo duration.
        </p>

        <div className="space-y-6 mb-6">
          {/* Amount Input */}
          <div>
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">
              Enter Dollars (Min $100, Max $5000)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-lg">$</span>
              <input
                type="number"
                min={100}
                max={5000}
                step={0.25}
                value={dollars || ''}
                onChange={e => setDollars(Number(e.target.value))}
                disabled={isProcessing}
                className="w-full text-base font-medium bg-white/5 text-white py-3.5 pl-10 pr-4 rounded-xl border border-white/10 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all shadow-sm disabled:opacity-50"
              />
            </div>
          </div>

          {/* Range Slider */}
          <div className="px-1">
            <input
              type="range"
              min={100}
              max={5000}
              step={0.25}
              value={dollars}
              onChange={e => setDollars(Number(e.target.value))}
              disabled={isProcessing}
              className="w-full accent-white h-2 bg-white/10 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
            />
            <div className="flex justify-between text-[11px] text-gray-500 font-bold mt-3">
              <span>$100</span>
              <span>$5,000</span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-center flex flex-col justify-center shadow-sm">
              <div className="text-lg font-black text-white leading-none">{selectedCredits || '0'}</div>
              <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-2">Credits</div>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-center flex flex-col justify-center shadow-sm">
              <div className="text-lg font-black text-white leading-none">{selectedCredits || '0'}</div>
              <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-2">Mins</div>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-center flex flex-col justify-center shadow-sm">
              <div className="text-lg font-black text-white leading-none">{sessionsAdded || '0'}</div>
              <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-2 leading-tight">Sessions <span className="opacity-70">({maxSessionDuration}m)</span></div>
            </div>
          </div>
        </div>

        <div className="bg-black/40 rounded-xl p-4 mb-6 border border-white/5">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-400">Total Price</span>
            <span className="text-white font-medium">${price.toFixed(2)} USD</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Sessions Added</span>
            <span className="text-emerald-400 font-medium">+{sessionsAdded} sessions</span>
          </div>
        </div>

        <div className="flex gap-3 w-full">
          <button 
            onClick={onClose}
            disabled={isProcessing}
            className="flex-1 px-4 py-3 rounded-xl border border-white/10 text-white font-medium hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        <button 
            onClick={handlePayment}
            disabled={isProcessing || dollars < 100}
            className="flex-1 px-4 py-3 rounded-xl bg-white hover:bg-gray-100 text-black font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? "Processing..." : "Continue Payment"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────

const GamePost: React.FC<GamePostProps> = ({
  user,
  description,
  createdAt,
  uniqueViewsCount,
  viewsCount,
  commentsCount,
  likesCount,
  isLiked,
  isWishlisted,
  onOpenDetails,
  onDeleteSuccess,
  disableInteractions,
  _id,
  gamePost,
}) => {
  const { user: currentUser } = useUser();
  
  // ─── COMPUTED VALUES ────────────────────────────────────────────────────────
  const isTestUpload = gamePost?.isTestUpload === true;
  const isOwner = currentUser?._id === user._id;
  const isAdmin = currentUser?.role === "admin";

  const snapshot = gamePost?.snapshot;

  const areAllSnapshotsReady =
    snapshot?.status === "ready" &&
    Array.isArray(snapshot?.regions) &&
    snapshot.regions.length > 0 &&
    snapshot.regions.every(
      (region: any) =>
        region?.status === "ready" &&
        !!region?.snapshotId
    );
  
  const isCreditLimited = !isTestUpload;
  const canRepurchase = isOwner && !isTestUpload;

  const postRef = useRef(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [showRepurchase, setShowRepurchase] = useState(false);
  
  const { isMuted, toggleMute, audioFocusId, setAudioFocusId } = useAudio();
  
  const isAudioActive = audioFocusId === null || audioFocusId === _id;

  // Local state for optimistic updates
  const [localRemainingCredits, setLocalRemainingCredits] = useState(gamePost.creditBudget?.remainingCredits || 0);

  // Optimistic Request sessions state
  const [hasRequested, setHasRequested] = useState(gamePost?.sessionRequest?.hasRequested || false);
  const [requestCount, setRequestCount] = useState(gamePost.gameMetrics?.sessionRequests || 0);
  const [requestLoading, setRequestLoading] = useState(false);
  
  const textRef = useRef<HTMLParagraphElement>(null);
  const [showReadMore, setShowReadMore] = useState(false);

  useEffect(() => {
    setLocalRemainingCredits(gamePost.creditBudget?.remainingCredits || 0);
  }, [gamePost.creditBudget?.remainingCredits]);

  const [eligibility, setEligibility] = useState<StreamEligibility>({
    checked: false,
    allowed: false,
    reasons: [],
    downloadMbps: null,
    uploadMbps: null,
    latencyMs: null,
    jitterMs: null,
  });
  const [checkingEligibility, setCheckingEligibility] = useState(false);

  const { likesCount: localLikesCount, isLiked: localIsLiked, handleLike } = useLikes(_id, BACKEND_URL);
  const { isWishlisted: localIsWishlisted, handleWishlist } = useWishlist(_id, BACKEND_URL);
  const { setIsAdPlaying } = useUI();
  const { queue, startSession } = useQueue();
  const navigate = useNavigate();

  const hasActiveSession = queue.sessionId !== null && ['waiting', 'allocation_ready', 'starting', 'running'].includes(queue.status);
  const playDisabled = checkingEligibility || isStarting || hasActiveSession;

  const playReason =
    eligibility.checked && !eligibility.allowed
      ? eligibility.reasons[0]
      : hasActiveSession
        ? "Complete or cancel current session first."
        : "";

  // ─── VIDEO OPTIMIZATION LOGIC ────────────────────────────────────────────────
  const videoDemo = gamePost?.videoDemo;
  const processingStatus = videoDemo?.processingStatus;
  const isVideoProcessing = processingStatus === 'pending' || processingStatus === 'processing';
  const isVideoCompleted = processingStatus === 'completed';
  const isVideoFailed = processingStatus === 'failed';

  const videoUrl = isVideoCompleted && videoDemo?.optimizedUrl ? videoDemo.optimizedUrl : videoDemo?.url;
  const thumbnailUrl = videoDemo?.thumbnailUrl;
  const hasVideo = !!videoUrl;

  const hasPlayedDemo =
    !isAdmin &&
    !isOwner &&
    gamePost?.demoConsumed === true;

  // ─── SESSION CALCULATIONS ───────────────────────
  const usedCredits = gamePost.creditBudget?.usedCredits || 0;
  const totalCredits = usedCredits + localRemainingCredits;
  const maxSessionDuration = gamePost.maxSessionDurationMinutes || 10; 
  
  const possibleSessions = Math.floor(totalCredits / maxSessionDuration);
  const possibleSessionsDisplay = isTestUpload ? '∞' : possibleSessions;
  
  const completedSessions = gamePost.gameMetrics?.totalSessions || 0;
  
  const isExhausted = isCreditLimited && localRemainingCredits === 0;

  const getRelativeTime = (date: string | Date) => {
    const now = new Date();
    const created = new Date(date);
    const diffMs = now.getTime() - created.getTime();
    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (seconds < 60) return `${seconds}s`;
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;

    return created.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const timestamp = useMemo(() => getRelativeTime(createdAt), [createdAt]);

  const handleStartGame = async () => {
    if (!currentUser) {
      navigate("/auth");
      return;
    }
    if (
      isStarting ||
      hasActiveSession ||
      checkingEligibility ||
      (isExhausted)
    )
      return;

    setCheckingEligibility(true);

    try {
      const result = await getStreamEligibility();
      setEligibility(result);

      if (!result.allowed) return;

      setIsStarting(true);
      trackEvent({
        eventType: "game_launch",
        targetType: "game_post",
        targetId: _id,
      });

      const sessionId = await startSession(_id);
      if (sessionId) {
        setIsAdPlaying(true);
      } else {
        setIsStarting(false);
      }
    } catch (err) {
      console.error("Failed to start game:", err);
      toast.error("Could not verify your device or internet.");
    } finally {
      setCheckingEligibility(false);
    }
  };

  const handleRequestSession = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (requestLoading || hasRequested) return;

    setRequestLoading(true);
    setHasRequested(true);
    setRequestCount((prev: number) => prev + 1);

    try {
      const res = await fetch(`${BACKEND_URL}/api/gamePosts/${_id}/request-session`, {
        method: "POST",
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to request sessions");
      }
    } catch (err: any) {
      setHasRequested(false);
      setRequestCount((prev: number) => prev - 1);
      toast.error(err.message);
    } finally {
      setRequestLoading(false);
    }
  };

  const handleDelete = async (postId: string) => {
    try {
      setIsDeleting(true);
      onDeleteSuccess?.(postId);

      await fetch(`${BACKEND_URL}/api/allposts/${postId}`, {
        method: "DELETE",
        credentials: "include",
      });

      setDeleteOpen(false);
      toast.success("Post deleted successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete post please try again later");
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    if (!queue.sessionId) {
      setIsStarting(false);
    }
  }, [queue.sessionId]);

  useEffect(() => {
    if (!videoRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target as HTMLVideoElement;
          if (entry.isIntersecting) {
            video.play().catch((err: any) => console.warn("Browser blocked autoplay:", err));
          } else {
            video.pause();
          }
        });
      },
      { threshold: 0.5 }
    );
    observer.observe(videoRef.current);
    return () => {
      if (videoRef.current) observer.unobserve(videoRef.current);
    };
  }, []);

  useEffect(() => {
  const checkOverflow = () => {
    if (textRef.current && !isExpanded) {
      // If scrollHeight is strictly greater than clientHeight, the text is being truncated
      setShowReadMore(
        textRef.current.scrollHeight > textRef.current.clientHeight
      );
    }
  };

  checkOverflow();
  window.addEventListener("resize", checkOverflow);
  
  return () => window.removeEventListener("resize", checkOverflow);
}, [description, isExpanded]);

const PlayButton = () => {

  if (hasPlayedDemo) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onOpenDetails?.();
        }}
        style={{
          background: "linear-gradient(to bottom right, #3D7A6E, #000000)",
        }}
        className="text-white px-3 py-2 rounded-2xl shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center gap-1.5 shrink-0 active:scale-[0.98]"
      >
        <Gamepad2 size={14} />
        <span className="font-semibold text-xs">
          Demo Played
        </span>
      </button>
    );
  }

  if (isExhausted) {

    if (hasRequested) {
        return (
            <button
                onClick={(e) => e.stopPropagation()}
                style={{
                    background:
                        "linear-gradient(to bottom right, #1d4ed8, #1e3a8a)",
                }}
                className="text-white px-3 py-2 rounded-2xl shadow-lg hover:shadow-xl transition-all shrink-0 cursor-default flex items-center gap-1.5"
            >
                <div className="flex flex-col items-start leading-tight">
                    <span className="font-semibold text-xs">
                        ✓ Requested
                    </span>
                    <span className="text-[7px] font-normal text-white/50 leading-none mt-0.5">
                        Waiting for creator
                    </span>
                </div>
                <div className="flex items-center border-l border-white/30 pl-2 ml-1.5 opacity-80 gap-1">
                <Users size={11} />
                <span className="text-[11px] font-medium">
                  {requestCount}
                </span>
              </div>
            </button>
        );
    }

    return (
      <button
        onClick={handleRequestSession}
        disabled={requestLoading}
        style={{
          background: "linear-gradient(to bottom right, #2563eb, #1e3a8a)",
        }}
        className="text-white px-3 py-2 rounded-2xl shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center gap-1.5 shrink-0 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="flex flex-col items-start leading-tight">
          <span className="font-semibold text-xs">
            {requestLoading ? "Requesting..." : "Request Sessions"}
          </span>
          <span className="text-[7px] font-normal text-white/50 leading-none mt-0.5">
            Credits exhausted
          </span>
        </div>
        <div className="flex items-center border-l border-white/30 pl-2 ml-1.5 opacity-80 gap-1">
          <Users size={11} />
          <span className="text-[11px] font-medium">
            {requestCount}
          </span>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        handleStartGame();
      }}
      disabled={playDisabled}
      title={playReason}
      style={{
        background: playDisabled
          ? "linear-gradient(to bottom right, #52525b, #18181b)"
          : "linear-gradient(to bottom right, #3D7A6E, #000000)",
      }}
      className="text-white px-3 py-2 rounded-2xl shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center gap-1.5 shrink-0 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <span className="font-semibold text-xs">
        {checkingEligibility
          ? "Checking..."
          : isStarting
          ? "Starting..."
          : hasActiveSession
          ? "Busy"
          : eligibility.checked && !eligibility.allowed
          ? "Unavailable"
          : "Play"}
      </span>

      <span className="text-[11px] font-medium opacity-80 border-l border-white/30 pl-1.5 ml-0.5 flex items-center gap-2">
        <Users size={14} className="animate-pulse" />
        {completedSessions}/{possibleSessionsDisplay}
      </span>
    </button>
  );
};

  return (
    <>
      <article
      
        ref={postRef}
        onClick={() => {
          onOpenDetails?.();
        }}
        className="relative w-full border border-white/[0.06] border-l-0 border-r-0 sm:border-l sm:border-r bg-white/[0.03] cursor-pointer transition-colors duration-200"
      >
        <div className="flex gap-3 p-4">
          <img
            src={user.avatar || "/default_avatar.png"}
            alt={user.username}
            onClick={(e) => {
              e.stopPropagation();
              trackEvent({
                eventType: "profile_view",
                targetType: "user",
                targetId: user._id,
                metadata: { from: "post", postId: _id },
              });
              navigate(`/profile/${user.username}`);
            }}
            className="h-10 w-10 rounded-full object-cover mt-1"
          />

          <div className="flex flex-col flex-1 min-w-0">
            <PostHeader
              type='game_post'
              username={user.username}
              displayName={user.displayName || user.username} 
              timestamp={timestamp}
              price={gamePost?.price || 0}
              postId={_id}
              isOwner={isOwner}
              isAdmin={isAdmin}
              isRigzer={user.isRigzer}
              onProfileClick={() => {
                trackEvent({
                  eventType: "profile_view",
                  targetType: "user",
                  targetId: user._id,
                  metadata: { from: "post", postId: _id },
                });
                navigate(`/profile/${user.username}`);
              }}
              onDelete={() => setDeleteOpen(true)}
            />

            {description && (
  <div className="mb-2">
    <p
      ref={textRef}
      className={`text-gray-200 leading-normal whitespace-pre-wrap transition-all ${
        !isExpanded ? "line-clamp-6" : ""
      }`}
    >
      {renderTextWithLinks(description)}
    </p>

    {(showReadMore || isExpanded) && (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}
        className="text-[rgb(98,212,174)] hover:text-[rgb(78,192,154)] font-semibold text-sm mt-1 focus:outline-none"
      >
        {isExpanded ? "Show less" : "Show more"}
      </button>
    )}
  </div>
)}

            {gamePost && (
              <div className="group relative rounded-2xl overflow-hidden border border-white/[0.06] bg-gradient-to-b from-[#1c1c1c] to-[#0a0a0a]">
                <div className="relative w-full h-[380px] overflow-hidden bg-gradient-to-b from-[#1e1e1e] to-[#0c0c0c]">
                  
                  {hasVideo ? (
                    <>
                      <video
                        ref={videoRef}
                        src={videoUrl}
                        poster={thumbnailUrl}
                        muted={!isAudioActive || isMuted}
                        loop
                        playsInline
                        preload="metadata"
                        className="absolute inset-0 w-full h-full object-cover opacity-90"
                      />

                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background: `
                            linear-gradient(
                              to bottom,
                              rgba(20,20,20,0.55) 0%,
                              rgba(10,10,10,0.08) 28%,
                              rgba(0,0,0,0.0)    50%,
                              rgba(0,0,0,0.08)   72%,
                              rgba(0,0,0,0.52)  100%
                            )
                          `,
                        }}
                      />

                      <div className="absolute top-4 left-4 z-40 flex items-center gap-3 w-[90%]">
                        <h3 className="text-2xl font-black text-white tracking-tight leading-none drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)] flex items-center min-w-0">
                          <span className="truncate">{gamePost.gameName}</span>
                          {isTestUpload && isAdmin && (
                            <span className="ml-3 bg-amber-500/20 border border-amber-500/50 text-amber-400 text-[10px] uppercase font-bold tracking-widest px-2.5 py-1 rounded-full shadow-sm drop-shadow-none shrink-0">TEST BUILD</span>
                          )}
                        </h3>
                        <div className="flex items-center gap-2 shrink-0">
                           {areAllSnapshotsReady && <PlayButton />}

                            {(canRepurchase) && (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setShowRepurchase(true);
                                }}
                                className="px-3 py-2 rounded-2xl transition-all bg-white/5 hover:bg-white/10 backdrop-blur-md shrink-0 active:scale-[0.98] border border-white/10"
                              >
                                <div className="flex flex-col items-start leading-none">
                                  <div className="flex items-center gap-1.5">
                                    <CreditCard size={14} className="text-gray-300" />
                                    <span className="font-semibold text-xs text-gray-100">
                                      Add Credits
                                    </span>
                                  </div>

                                  {isExhausted && (
                                    <span className="ml-[20px] mt-1 text-[9px] font-medium text-gray-400">
                                      Credits exhausted
                                    </span>
                                  )}
                                </div>
                              </button>
                                )}
                        </div>
                      </div>

                      <div className="absolute bottom-4 left-4 z-40 flex items-center gap-2 pointer-events-none">
                        <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl px-3 py-1.5 shadow-xl">
                          <Clock size={12} className="text-gray-400" />
                          <div className="flex flex-col items-start leading-none">
                            <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Duration</span>
                            <span className="text-xs font-bold text-white">{maxSessionDuration} min</span>
                          </div>
                        </div>
                      </div>

                      {/* SESSION METADATA & VOLUME - BOTTOM RIGHT */}
                      <div className="absolute bottom-4 right-4 z-40 flex flex-col items-end gap-2 pointer-events-none">
                        <div className="pointer-events-auto mt-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleMute();
                            }}
                            className="p-2 rounded-full bg-black/40 backdrop-blur-md text-white border border-white/20 hover:bg-black/60 transition-colors"
                          >
                            {isMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="relative w-full h-full p-6">
                      <div className="flex items-center gap-3 mb-2 w-full">
                        <h3 className="text-2xl font-black text-white tracking-tight leading-none flex items-center min-w-0">
                          <span className="truncate">{gamePost.gameName}</span>
                          {isTestUpload && isAdmin && (
                            <span className="ml-3 bg-amber-500/20 border border-amber-500/50 text-amber-400 text-[10px] uppercase font-bold tracking-widest px-2.5 py-1 rounded-full shadow-sm shrink-0">TEST BUILD</span>
                          )}
                        </h3>
                        <div className="flex items-center gap-2 shrink-0">
                          {areAllSnapshotsReady && <PlayButton />}

                          {(canRepurchase) && (
<button
  onClick={(e) => {
    e.stopPropagation();
    setShowRepurchase(true);
  }}
  style={{
    background: "linear-gradient(to bottom right, #047857, #000000)",
  }}
  className="text-white px-3 py-2 rounded-2xl shadow-lg hover:shadow-xl transition-all hover:scale-105 shrink-0 active:scale-[0.98]"
>
  <div className="flex flex-col items-start leading-none">
    <div className="flex items-center gap-1.5">
      <CreditCard size={14} />
      <span className="font-semibold text-xs">
        Add Credits
      </span>
    </div>

    {isExhausted && (
      <span className="ml-[20px] mt-1 text-[8px] font-normal text-white/50">
        Credits exhausted
      </span>
    )}
  </div>
</button>
                          )}
                        </div>
                      </div>
                      
                      {/* SESSION METADATA - BOTTOM RIGHT FOR NON-VIDEO STATE */}
                      <div className="absolute bottom-4 right-4 z-40 flex flex-col items-end gap-2 pointer-events-none">
                        <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl px-3 py-1.5 shadow-xl">
                          <Clock size={12} className="text-gray-400" />
                          <div className="flex flex-col items-start leading-none">
                            <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Duration</span>
                            <span className="text-xs font-bold text-white">{maxSessionDuration} min</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl px-3 py-1.5 shadow-xl">
                          <Gamepad2 size={12} className="text-gray-400" />
                          <div className="flex flex-col items-start leading-none">
                            <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Sessions</span>
                            <span className="text-xs font-bold text-white">{completedSessions} / {possibleSessionsDisplay}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Eligibility warning */}
                {eligibility.checked && !eligibility.allowed && eligibility.reasons.length > 0 && (
                  <div className="mt-4 w-full rounded-xl border border-amber-400/30 bg-amber-500/10 p-3">
                    <div className="flex items-start gap-2 text-amber-300">
                      <AlertCircle size={16} className="mt-0.5 shrink-0" />
                      <div className="text-xs leading-5">
                        {eligibility.reasons.some((r) => r.includes("Mobile support is coming soon")) ? (
                          <p className="font-semibold">Mobile support is coming soon. Please use a laptop or desktop.</p>
                        ) : (
                          <>
                            <p className="font-semibold">You cannot play this stream yet:</p>
                            <ul className="mt-1 list-disc pl-4 space-y-1">
                              {eligibility.reasons.map((reason) => (
                                <li key={reason}>{reason}</li>
                              ))}
                            </ul>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

              </div>
            )}

            {!disableInteractions && (
              <div onClick={(e) => e.stopPropagation()}>
                <PostInteractions
                  postId={_id}
                  views={viewsCount}
                  likes={localLikesCount}
                  comments={commentsCount ?? 0}
                  isLiked={localIsLiked}
                  isWishlisted={localIsWishlisted}
                  onLike={handleLike}
                  onWishlist={handleWishlist}
                  onCommentToggle={() => onOpenDetails?.()}
                />
              </div>
            )}
          </div>
        </div>

        <ConfirmDeleteModal
          open={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          onConfirm={() => handleDelete(_id)}
          loading={isDeleting}
        />
        
      </article>
        <RepurchaseModal 
          isOpen={showRepurchase} 
          gameName={gamePost?.gameName}
          currentUser={currentUser}
          onClose={() => setShowRepurchase(false)}
          postId={_id}
          maxSessionDuration={maxSessionDuration}
          onSuccess={(addedCredits) => {
            setLocalRemainingCredits((prev : number) => prev + addedCredits);
          }}
        />
    </>
  );
};

export default GamePost;