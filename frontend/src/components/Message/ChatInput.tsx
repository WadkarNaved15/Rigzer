import React, { useRef, useEffect } from "react";
import EmojiPicker from "emoji-picker-react";
import { Paperclip, Smile, ArrowUp, X } from "lucide-react";
import { Message } from "./types";

interface ChatInputProps {
  isMaximized: boolean;
  isChatInitializing: boolean;
  currentChatId: string | null;
  message: string;
  onMessageChange: (value: string) => void;
  onSend: () => void;
  onKeyPress: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  canSendMessages: boolean;
  activeUserName?: string;
  onFileButtonClick: () => void;
  showEmojiPicker: boolean;
  onToggleEmojiPicker: () => void;
  onEmojiClick: (emojiData: { emoji: string }) => void;

  // Reply state
  replyingTo: Message | null;
  onCancelReply: () => void;
}

const MAX_HEIGHT = 160;

const ChatInput: React.FC<ChatInputProps> = ({
  isMaximized,
  isChatInitializing,
  currentChatId,
  message,
  onMessageChange,
  onSend,
  onKeyPress,
  canSendMessages,
  activeUserName,
  onFileButtonClick,
  showEmojiPicker,
  onToggleEmojiPicker,
  onEmojiClick,

  // Reply
  replyingTo,
  onCancelReply,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);

  // --------------------------------------------------
  // Auto-grow textarea
  // --------------------------------------------------

  useEffect(() => {
    const el = textareaRef.current;

    if (!el) return;

    el.style.height = "36px";

    const next = Math.min(el.scrollHeight, MAX_HEIGHT);

    el.style.height = `${next}px`;
    el.style.overflowY =
      el.scrollHeight > MAX_HEIGHT ? "auto" : "hidden";
  }, [message]);

  // --------------------------------------------------
  // Focus textarea when starting a reply
  // --------------------------------------------------

  useEffect(() => {
    if (!replyingTo) return;

    // Wait for the reply preview to render before focusing.
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }, [replyingTo]);

  // --------------------------------------------------
  // Close emoji picker when clicking outside
  // --------------------------------------------------

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showEmojiPicker &&
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target as Node) &&
        emojiButtonRef.current &&
        !emojiButtonRef.current.contains(event.target as Node)
      ) {
        onToggleEmojiPicker();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, [showEmojiPicker, onToggleEmojiPicker]);

  // --------------------------------------------------
  // Reply preview content
  // --------------------------------------------------

  const getReplyPreview = () => {
    if (!replyingTo) return "";

    if (replyingTo.text?.trim()) {
      return replyingTo.text;
    }

    if (replyingTo.mediaType === "image") {
      return "📷 Photo";
    }

    if (replyingTo.mediaType === "video") {
      return "🎥 Video";
    }

    if (replyingTo.messageType === "post") {
      return "Shared post";
    }

    return "Message";
  };

  const replySenderName =
    replyingTo?.senderId === replyingTo?.receiverId
      ? "You"
      : replyingTo?.senderId === replyingTo?.receiverId
        ? "You"
        : "Message";

  return (
    <footer className="flex-shrink-0 pl-2 pr-3 pb-2 sm:pl-3 sm:pr-4 sm:pb-3">
      <div
        className={`flex flex-col ${isMaximized ? "mx-[3%]" : ""
          } rounded-[24px] border border-white/10
        bg-white/[0.05]
        focus-within:bg-white/[0.08]
        transition-colors`}
      >
        {/* ================================================
            Reply Preview
            ================================================ */}

        {replyingTo && (
          <div className="px-3 pt-2.5">
            <div
              className="
        flex items-center gap-2
        rounded-xl
        border-l-2 border-white/50
        bg-white/[0.06]
        px-3 py-2
      "
            >
              <div className="min-w-0 flex-1 flex items-center gap-2">
                {/* Image preview */}
                {replyingTo.mediaType === "image" && replyingTo.mediaUrl && (
                  <img
                    src={replyingTo.mediaUrl}
                    alt="Reply preview"
                    crossOrigin="anonymous"
                    className="
              w-12 h-12
              rounded-md
              object-cover
              shrink-0
              bg-black
            "
                  />
                )}

                {/* Video preview */}
                {replyingTo.mediaType === "video" && replyingTo.mediaUrl && (
                  <div className="relative w-12 h-12 shrink-0 overflow-hidden rounded-md bg-black">
                    <video
                      src={replyingTo.mediaUrl}
                      crossOrigin="anonymous"
                      preload="metadata"
                      muted
                      className="w-full h-full object-cover"
                    />

                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <span className="text-white text-sm">
                        ▶
                      </span>
                    </div>
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-white/70 mb-0.5">
                    Replying to message
                  </p>

                  <p
                    className="text-xs text-white/70 truncate"
                    title={getReplyPreview()}
                  >
                    {getReplyPreview()}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onCancelReply}
                className="
          shrink-0
          w-7 h-7
          flex items-center justify-center
          rounded-full
          text-white/50
          hover:text-white
          hover:bg-white/[0.08]
          transition-colors
        "
                aria-label="Cancel reply"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ================================================
            Input Row
            ================================================ */}

        <div className="flex items-end gap-1.5 sm:gap-2 p-1.5 sm:p-2">
          {/* Attachment */}

          <button
            type="button"
            onClick={onFileButtonClick}
            disabled={!canSendMessages || isChatInitializing ||
  !currentChatId ||
  !message.trim()}
            className="
              shrink-0
              w-9 h-9
              flex items-center justify-center
              rounded-full
              text-white/50
              hover:text-white
              hover:bg-white/[0.08]
              transition-colors
              disabled:opacity-30
              disabled:cursor-not-allowed
            "
            aria-label="Attach media"
          >
            <Paperclip size={18} />
          </button>

          {/* Text input */}

          <div className="flex-1 relative min-w-0 flex flex-col justify-end">
            {showEmojiPicker && (
              <div
                ref={emojiPickerRef}
                className="absolute bottom-full mb-2 right-0 z-50"
              >
                <EmojiPicker
                  onEmojiClick={onEmojiClick}
                  height={400}
                />
              </div>
            )}

            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) =>
                onMessageChange(e.target.value)
              }
              onKeyDown={onKeyPress}
              disabled={!canSendMessages}
              placeholder={
                !canSendMessages
                  ? "Accept this chat request to reply..."
                  : replyingTo
                    ? "Write a reply..."
                    : "Type a message..."
              }
              rows={1}
              className="
                w-full
                bg-transparent
                resize-none
                focus:outline-none
                text-sm
                text-white
                placeholder-white/40
                m-0
                px-1
                py-[8px]
                leading-[20px]
                border-0
              "
              style={{
                minHeight: "36px",
                maxHeight: `${MAX_HEIGHT}px`,
              }}
            />
          </div>

          {/* Emoji */}

          <button
            ref={emojiButtonRef}
            type="button"
            onClick={onToggleEmojiPicker}
            disabled={!canSendMessages}
            className="
              shrink-0
              w-9 h-9
              flex items-center justify-center
              rounded-full
              text-white/50
              hover:text-white
              hover:bg-white/[0.08]
              transition-colors
              disabled:opacity-30
              disabled:cursor-not-allowed
            "
            aria-label="Open emoji picker"
          >
            <Smile size={18} />
          </button>

          {/* Send */}

          <button
            type="button"
            onClick={onSend}
            disabled={
              !canSendMessages ||
              !message.trim()
            }
            className="
              shrink-0
              w-9 h-9
              flex items-center justify-center
              rounded-full
              bg-white
              text-black
              hover:bg-white/90
              disabled:bg-white/10
              disabled:text-white/30
              disabled:cursor-not-allowed
              transition-colors
              shadow-sm
            "
            aria-label="Send message"
          >
            <ArrowUp
              size={18}
              strokeWidth={2.5}
            />
          </button>
        </div>
      </div>
    </footer>
  );
};

export default ChatInput;