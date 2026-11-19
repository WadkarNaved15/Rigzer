import React, { useState, useRef, useEffect } from "react";
import { useSocket } from "../../context/SocketContext";
import axios from "axios";
import { useUser } from "../../context/user";
import { useChat } from "../../context/ChatContext";
import { useUsers } from "../../context/UsersContext";
import MediaViewer from "../Media/MediaViewer";
import { toast } from "react-toastify";

import ChatToggleButton from "../Message/ChatToggleButton";
import ChatHeader from "../Message/ChatHeader";
import UsersListPanel from "../Message/UsersListPanel";
import ChatMessageList from "../Message/ChatMessageList";
import ChatInput from "../Message/ChatInput";
import { Message, ChatId, MediaViewerState } from "../Message/types";
import { MessageCircle } from "lucide-react";
import { getE2EEClient } from "../../lib/e2ee/client";
import { saveDecryptedMessage , getDecryptedMessages} from "../../lib/e2ee/messageStore";

type UploadAsset = {
  file: File;
  type: "image" | "video" | "misc";
};

const MessagingComponent = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [message, setMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [activeChat, setActiveChat] = useState<ChatId | null>(null);
  const [requestedUser, setRequestedUser] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState<"accepted" | "declined" | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [chatHasMore, setChatHasMore] = useState<Record<string, boolean>>({});
  const [chatCursors, setChatCursors] = useState<Record<string, string | null>>({});
  const [loadingOlderMessages, setLoadingOlderMessages] = useState<
    Record<string, boolean>
  >({});
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [mediaViewer, setMediaViewer] = useState<MediaViewerState | null>(null);
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
  const [activeChatStatus, setActiveChatStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useUser();
  const { users, loading, setUsers } = useUsers();
  const currentUser = user?._id;
  const { targetUser } = useChat();
  const socket = useSocket();
  const [isRendered, setIsRendered] = useState(false); // NEW: Controls actual DOM presence 
  const [isVisible, setIsVisible] = useState(false);
  const chatRequestIdRef = useRef(0);
  const isFetchingOlderRef = useRef<Record<string, boolean>>({});
  const lastFetchedCursorRef = useRef<Record<string, string | null>>({});
  const pendingJumpMessageRef = useRef<Record<string, string | null>>({});
  const replyJumpInProgressRef = useRef<Record<string, boolean>>({});
  const CHAT_PAGE_SIZE = 30;
  const [isChatInitializing, setIsChatInitializing] = useState(false);
  

  // Maximum amount of history that an automatic reply-preview jump
  // is allowed to load.
  const MAX_REPLY_JUMP_MESSAGES = 150;
  const MAX_REPLY_JUMP_PAGES = Math.ceil(
    MAX_REPLY_JUMP_MESSAGES / CHAT_PAGE_SIZE
  );
  const paginationRef = useRef<
    Record<
      string,
      {
        cursor: string | null;
        hasMore: boolean;
      }
    >
  >({});


useEffect(() => {
  if (!currentUser || !socket) return;

  const handleEnvelopeAvailable = (payload: {
    envelopeId: string;
    targetDeviceId: number;
  }) => {
    console.info("[E2EE] Socket notification received:", payload);

    window.dispatchEvent(
      new CustomEvent("e2ee:envelope-available", {
        detail: payload,
      })
    );
  };

  socket.on("e2ee:envelope-available", handleEnvelopeAvailable);

  return () => {
    socket.off("e2ee:envelope-available", handleEnvelopeAvailable);
  };
}, [currentUser, socket]);


  // NEW: Delays the unmounting of the chat window so the close animation can play
  useEffect(() => {
    if (isOpen) {
      setIsRendered(true); // 1. Put it in the DOM
      const timer = setTimeout(() => setIsVisible(true), 100); // 2. Wait 100ms, then trigger animation
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false); // 1. Trigger the close animation
      const timer = setTimeout(() => setIsRendered(false), 300); // 2. Wait 300ms, then remove from DOM
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // CSS animation for shine
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
    @keyframes shine {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(400%); }
    }
    .animate-shine {
      animation: shine 3s infinite;
    }
  `;
    document.head.appendChild(style);

    return () => {
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    };
  }, []);

  const [conversations, setConversations] = useState<Record<string, Message[]>>({});

  const hydrateMessagesFromLocalStore = async (
  messages: Message[],
  ownerUserId: string
): Promise<Message[]> => {
  try {
    const e2eeMessageIds = messages
      .map((msg) => msg.e2eeMessageId)
      .filter(
        (id): id is string =>
          typeof id === "string" && id.length > 0
      );

    if (e2eeMessageIds.length === 0) {
      return messages;
    }

    const localMessages = await getDecryptedMessages(
      ownerUserId,
      e2eeMessageIds
    );

    return messages.map((msg) => {
      const e2eeMessageId = msg.e2eeMessageId;

      if (!e2eeMessageId) {
        return msg;
      }

      const localMessage = localMessages.get(e2eeMessageId);

      if (!localMessage) {
        return msg;
      }

      return {
        ...msg,
        text: localMessage.text,
      };
    });
  } catch (error) {
    console.error(
      "[E2EE] Failed to restore local message history:",
      error
    );

    // Do not prevent MongoDB history from loading if IndexedDB fails.
    return messages;
  }
};

  const uploadChatMediaToS3 = async (
    asset: UploadAsset,
    onProgress: (percent: number) => void
  ): Promise<{ fileUrl: string; key: string }> => {
    const res = await fetch(`${BACKEND_URL}/api/upload/presigned-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        fileName: asset.file.name,
        fileType: asset.file.type,
        category: "media",
      }),
    });

    if (!res.ok) {
      throw new Error("Failed to get presigned URL");
    }

    const { uploadUrl, fileUrl, key } = await res.json();

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.open("PUT", uploadUrl, true);
      xhr.setRequestHeader("Content-Type", asset.file.type);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          resolve({ fileUrl, key });
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error("Upload network error"));

      xhr.send(asset.file);
    });
  };

  const fetchOlderMessagesPage = async (
    userId: string,
    chatId: string,
    cursor: string
  ): Promise<{
    messages: Message[];
    hasMore: boolean;
    nextCursor: string | null;
  } | null> => {
    if (isFetchingOlderRef.current[userId]) {
      return null;
    }

    isFetchingOlderRef.current[userId] = true;

    setLoadingOlderMessages((prev) => ({
      ...prev,
      [userId]: true,
    }));

    try {
      const { data } = await axios.get(
        `${BACKEND_URL}/api/messages/${chatId}`,
        {
          params: {
            before: cursor,
            limit: CHAT_PAGE_SIZE,
          },
          withCredentials: true,
        }
      );

      const olderMessages: Message[] = await hydrateMessagesFromLocalStore(
        data.messages || [],
        currentUser!
      );

      setConversations((prev) => {
        const existing = prev[userId] || [];

        const existingIds = new Set(
          existing
            .map((message) => message._id)
            .filter(Boolean)
        );

        const deduped = olderMessages.filter(
          (message) =>
            message._id &&
            !existingIds.has(message._id)
        );

        return {
          ...prev,
          [userId]: [...deduped, ...existing],
        };
      });

      const hasMore = Boolean(data.hasMore);
      const nextCursor = data.nextCursor ?? null;

      // IMPORTANT:
      // Keep pagination state synchronously available through the ref.
      paginationRef.current[userId] = {
        cursor: nextCursor,
        hasMore,
      };

      setChatHasMore((prev) => ({
        ...prev,
        [userId]: hasMore,
      }));

      setChatCursors((prev) => ({
        ...prev,
        [userId]: nextCursor,
      }));

      lastFetchedCursorRef.current[userId] = cursor;

      return {
        messages: olderMessages,
        hasMore,
        nextCursor,
      };
    } catch (error) {
      console.error(
        "Failed to fetch older messages:",
        error
      );

      return null;
    } finally {
      isFetchingOlderRef.current[userId] = false;

      setLoadingOlderMessages((prev) => ({
        ...prev,
        [userId]: false,
      }));
    }
  };

  const loadOlderMessages = async () => {
    if (!activeChat || !currentChatId) return;

    const userId = activeChat;

    if (isFetchingOlderRef.current[userId]) {
      return;
    }

    const pagination = paginationRef.current[userId];

    const cursor =
      pagination?.cursor ??
      chatCursors[userId];

    const hasMore =
      pagination?.hasMore ??
      chatHasMore[userId];

    if (!hasMore || !cursor) {
      return;
    }

    const result = await fetchOlderMessagesPage(
      userId,
      currentChatId,
      cursor
    );

    if (!result) {
      return;
    }
  };

  const handleReplyPreviewClick = async (messageId: string) => {
    if (!messageId || !activeChat) return;

    // If the message is already loaded, ChatMessageList can
    // scroll to it immediately.
    const loaded = (conversations[activeChat] || []).some(
      (message) => message._id === messageId
    );

    if (loaded) {
      return;
    }

    await loadOlderMessagesUntilFound(messageId);
  };

  const loadOlderMessagesUntilFound = async (
    targetMessageId: string
  ): Promise<boolean> => {
    if (!activeChat || !currentChatId) {
      return false;
    }

    const userId = activeChat;
    const chatId = currentChatId;

    if (replyJumpInProgressRef.current[userId]) {
      return false;
    }
    replyJumpInProgressRef.current[userId] = true;

    pendingJumpMessageRef.current[userId] = targetMessageId;

    let pagesFetched = 0;
    let messagesFetched = 0;

    try {
      // ------------------------------------------------------------
      // 1. Check if target is already loaded.
      // ------------------------------------------------------------

      const existingMessages =
        conversations[userId] || [];

      if (
        existingMessages.some(
          (message) => message._id === targetMessageId
        )
      ) {
        return true;
      }

      // ------------------------------------------------------------
      // 2. Get current pagination state.
      // ------------------------------------------------------------

      let pagination =
        paginationRef.current[userId];

      let cursor =
        pagination?.cursor ??
        chatCursors[userId] ??
        null;

      let hasMore =
        pagination?.hasMore ??
        chatHasMore[userId] ??
        false;

      // ------------------------------------------------------------
      // 3. Automatically fetch older pages.
      //
      // IMPORTANT:
      // This loop has a hard maximum.
      // ------------------------------------------------------------

      while (hasMore && cursor) {

        // ----------------------------------------------------------
        // HARD SAFETY LIMIT
        // ----------------------------------------------------------

        if (pagesFetched >= MAX_REPLY_JUMP_PAGES) {
          toast.info(
            `This message is too far back to jump to automatically. ` +
            `Scroll up manually to load older messages.`
          );

          return false;
        }

        // ----------------------------------------------------------
        // Make sure the user hasn't switched chats.
        // ----------------------------------------------------------

        if (
          activeChat !== userId ||
          currentChatId !== chatId
        ) {
          return false;
        }

        // ----------------------------------------------------------
        // Prevent concurrent pagination requests.
        // ----------------------------------------------------------

        if (isFetchingOlderRef.current[userId]) {
          await new Promise((resolve) =>
            setTimeout(resolve, 25)
          );

          pagination =
            paginationRef.current[userId];

          cursor =
            pagination?.cursor ?? null;

          hasMore =
            pagination?.hasMore ?? false;

          continue;
        }

        // ----------------------------------------------------------
        // Fetch EXACTLY ONE page.
        // ----------------------------------------------------------

        const result =
          await fetchOlderMessagesPage(
            userId,
            chatId,
            cursor
          );

        if (!result) {
          return false;
        }

        pagesFetched += 1;

        messagesFetched += result.messages.length;

        // ----------------------------------------------------------
        // Check whether target exists in this page.
        // ----------------------------------------------------------

        const foundInPage =
          result.messages.some(
            (message) =>
              message._id === targetMessageId
          );

        if (foundInPage) {
          return true;
        }

        // ----------------------------------------------------------
        // Move to next cursor.
        // ----------------------------------------------------------

        cursor = result.nextCursor;
        hasMore = result.hasMore;

        // ----------------------------------------------------------
        // Stop if backend says there are no more messages.
        // ----------------------------------------------------------

        if (!hasMore || !cursor) {
          return false;
        }

        if (messagesFetched >= MAX_REPLY_JUMP_MESSAGES) {
          toast.info(
            `This message is too far back to jump to automatically. ` +
            `Scroll up manually to load older messages.`
          );

          return false;
        }
      }

      return false;

    } finally {
      replyJumpInProgressRef.current[userId] = false;
      if (
        pendingJumpMessageRef.current[userId] ===
        targetMessageId
      ) {
        pendingJumpMessageRef.current[userId] = null;
      }
    }
  };

  const onEmojiClick = (emojiData: { emoji: string }) => {
    setMessage((prev) => prev + emojiData.emoji);
  };

  useEffect(() => {
    if (!currentUser) return;

    const fetchUnreadCounts = async () => {
      try {
        const res = await axios.get(`${BACKEND_URL}/api/messages/unread-counts`, { withCredentials: true });

        const counts: Record<string, number> = {};
        res.data.forEach((item: any) => {
          counts[item._id] = item.count;
        });

        setUnreadCounts((prev) => ({ ...prev, ...counts }));
      } catch (err) {
        console.error("Failed to load unread counts", err);
      }
    };

    fetchUnreadCounts();
  }, [currentUser]);

  useEffect(() => {
    if (!targetUser || targetUser.id === currentUser) return;

    setIsOpen(true);

    setUsers((prev) => {
      const exists = prev.find((u) => u.id === targetUser.id);
      if (exists) return prev;

      return [
        {
          id: targetUser.id,
          name: targetUser.name,
          avatar: targetUser.avatar,
          unreadCount: 0,
          lastSeen: "Just now",
        },
        ...prev,
      ];
    });

    handleUserClick(targetUser.id);
  }, [targetUser, currentUser]);



useEffect(() => {
  if (!currentUser) return;

  const handleDecryptedMessage = (event: Event) => {
    const decrypted = (event as CustomEvent).detail;

    if (!decrypted?.payload || !decrypted?.senderId) return;

    const payload = decrypted.payload;

    if (payload.type !== "text" || !payload.chatId) return;

    const otherUserId = decrypted.senderId;
    const e2eeMessageId = decrypted.messageId;

    const newMessage: Message = {
      _id: decrypted.mongoMessageId || e2eeMessageId,
      chatId: payload.chatId,
      senderId: decrypted.senderId,
      receiverId: currentUser,
      text: payload.text ?? "",
      messageType: "text",
      createdAt: new Date(decrypted.timestamp),
      replyTo: payload.replyTo ?? null,
      e2eeMessageId,
    } as Message;

    console.log("[E2EE UI] Updating conversation:", {
      otherUserId,
      e2eeMessageId,
      mongoMessageId: decrypted.mongoMessageId,
      text: payload.text,
    });

    setConversations((prev) => {
      const existing = prev[otherUserId] || [];

      // Find an existing metadata-only message.
      const existingIndex = existing.findIndex(
        (message) =>
          (message as any).e2eeMessageId === e2eeMessageId ||
          (
            decrypted.mongoMessageId &&
            message._id === decrypted.mongoMessageId
          )
      );

      // If metadata already exists, UPDATE it with decrypted text.
      if (existingIndex !== -1) {
        const updated = [...existing];

        updated[existingIndex] = {
          ...updated[existingIndex],
          ...newMessage,
          _id:
            decrypted.mongoMessageId ||
            updated[existingIndex]._id,
          e2eeMessageId,
          text: payload.text ?? "",
        } as Message;

        return {
          ...prev,
          [otherUserId]: updated,
        };
      }

      // Otherwise, insert a new message.
      return {
        ...prev,
        [otherUserId]: [...existing, newMessage],
      };
    });

    if (activeChat !== otherUserId) {
      setUnreadCounts((prev) => ({
        ...prev,
        [otherUserId]: (prev[otherUserId] || 0) + 1,
      }));
    }
  };

  window.addEventListener(
    "e2ee:message-decrypted",
    handleDecryptedMessage
  );

  return () => {
    window.removeEventListener(
      "e2ee:message-decrypted",
      handleDecryptedMessage
    );
  };
}, [currentUser, activeChat]);


  useEffect(() => {
    if (!socket) return;

    socket.on("online-users", (users: string[]) => {
      setOnlineUsers(users);
    });

    socket.on("user-online", (userId: string) => {
      setOnlineUsers((prev) => (prev.includes(userId) ? prev : [...prev, userId]));
    });

    socket.on("user-offline", (userId: string) => {
      setOnlineUsers((prev) => prev.filter((id) => id !== userId));
    });

    return () => {
      socket.off("online-users");
      socket.off("user-online");
      socket.off("user-offline");
    };
  }, [socket]);

  // useEffect(() => {
  //   if (!socket || !currentUser) return;

  //   const unreadHandler = ({ senderId }: any) => {
  //     // 1. Check if the message is from the active chat
  //     if (senderId === activeChat) {
  //       // 2. Tell the backend it was seen immediately
  //       if (currentChatId) {
  //         markChatAsSeen(currentChatId, senderId);
  //       }
  //       // 3. Exit early so the unread count DOES NOT increment
  //       return;
  //     }

  //     setUnreadCounts((prev) => ({
  //       ...prev,
  //       [senderId]: (prev[senderId] || 0) + 1,
  //     }));
  //   };

  //   socket.on("new-unread-message", unreadHandler);

  //   return () => {
  //     socket.off("new-unread-message", unreadHandler);
  //   };
  //   // 4. IMPORTANT: Add activeChat and currentChatId here so the function has the latest data
  // }, [socket, currentUser, activeChat, currentChatId]);

  useEffect(() => {
    if (!socket || !currentUser) return;
    const handler = (msg: any) => {
      if (!currentUser) return;

      if (!currentChatId) {
        setCurrentChatId(msg.chatId);
        socket.emit("join_chat", msg.chatId);
      }

      const otherUserId = msg.senderId === currentUser ? msg.receiverId : msg.senderId;

      setConversations((prev) => {
        const existingMessages = prev[otherUserId] || [];

        if (msg.senderId === currentUser && msg.tempId) {
          return {
            ...prev,
            [otherUserId]: existingMessages.map((m) => (m.tempId === msg.tempId ? msg : m)),
          };
        }

        return {
          ...prev,
          [otherUserId]: [...existingMessages, msg],
        };
      });
    };

    socket.on("receive-message", handler);

    return () => {
      socket.off("receive-message", handler);
    };
  }, [socket, currentUser, activeChat, currentChatId]);

  useEffect(() => {
    if (!socket) return;

    const handleMessageDeleted = ({ messageId }: any) => {
      setConversations((prev) => {
        const updated = { ...prev };

        Object.keys(updated).forEach((userId) => {
          updated[userId] = updated[userId].filter((msg) => msg._id !== messageId);
        });

        return updated;
      });
    };

    socket.on("message-deleted", handleMessageDeleted);

    return () => {
      socket.off("message-deleted", handleMessageDeleted);
    };
  }, [socket]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!socket || !currentUser) return;
    if (!canSendMessages) return;
    const file = e.target.files?.[0];
    if (!file || !currentChatId || !activeChat || !currentUser) return;

    const toastId = toast.loading("Uploading... 0%");

    try {
      const { fileUrl, key } = await uploadChatMediaToS3(
        {
          file,
          type: file.type.startsWith("image") ? "image" : file.type.startsWith("video") ? "video" : "misc",
        },
        (progress) => {
          toast.update(toastId, {
            render: `Uploading... ${progress}%`,
            isLoading: true,
          });
        }
      );

      toast.update(toastId, {
        render: "Upload complete!",
        type: "success",
        isLoading: false,
        autoClose: 1200,
      });
      const tempId = crypto.randomUUID();
      const replyTo = replyingTo?._id
        ? {
          messageId: replyingTo._id,
          senderId: replyingTo.senderId,
          text: replyingTo.text || null,
          messageType: replyingTo.messageType || "text",
          mediaType: replyingTo.mediaType || null,
        }
        : null;

      const newMessage: Message = {
        tempId,
        chatId: currentChatId,
        senderId: currentUser,
        receiverId: activeChat,
        text: "",
        mediaUrl: fileUrl,
        mediaKey: key,
        mediaType: file.type.startsWith("image") ? "image" : file.type.startsWith("video") ? "video" : null,
        messageType: "media",
        replyTo,
        createdAt: new Date(),
      };

      socket.emit(
        "send-message",
        newMessage,
        (response: {
          success: boolean;
          chatId?: string;
        }) => {
          if (!response?.success || !response.chatId) {
            return;
          }

          setCurrentChatId(response.chatId);
        }
      );

      setConversations((prev) => ({
        ...prev,
        [activeChat]: [...(prev[activeChat] || []), newMessage],
      }));
      setReplyingTo(null);
    } catch (err) {
      console.error(err);

      toast.update(toastId, {
        render: "Upload failed!",
        type: "error",
        isLoading: false,
        autoClose: 2000,
      });
    } finally {
      e.target.value = "";
    }
  };
const markChatAsSeen = async (chatId: string, userId: string) => {
  if (!chatId || !userId) return;

  try {
    const { data } = await axios.put(
      `${BACKEND_URL}/api/messages/seen/${chatId}`,
      {},
      { withCredentials: true }
    );

    console.log("[CHAT] Messages marked as seen:", {
      chatId,
      userId,
      modifiedCount: data.modifiedCount,
    });

    setUnreadCounts((prev) => ({
      ...prev,
      [userId]: 0,
    }));

    // Update locally loaded messages.
const seenAt = new Date().toISOString();

setConversations((prev) => ({
  ...prev,
  [userId]: (prev[userId] || []).map((msg) =>
    msg.receiverId === currentUser && !msg.seen
      ? {
          ...msg,
          seen: true,
          seenAt,
        }
      : msg
  ),
}));
  } catch (error) {
    console.error("[CHAT] Failed to mark messages as seen:", error);
  }
};



const handleUserClick = async (receiverId: string) => {
  if (receiverId === currentUser) {
    toast.error("Cannot chat with yourself");
    return;
  }

  const requestId = ++chatRequestIdRef.current;
  const startedAt = performance.now();

  const logTime = (label: string, start: number) => {
    const duration = (performance.now() - start).toFixed(2);
    console.log(`[CHAT PERF] ${label}: ${duration}ms`);
  };

  console.group(
    `[CHAT PERF] Opening chat: ${receiverId} | Request: ${requestId}`
  );

  console.log("[CHAT] Initialization started", {
    receiverId,
    currentUser,
    requestId,
    timestamp: new Date().toISOString(),
  });

  setIsChatInitializing(true);
  setCurrentChatId(null);
  setActiveChat(receiverId);

  try {
    // 1. Leave previous chat
    const leaveStart = performance.now();

    if (currentChatId && socket) {
      socket.emit("leave_chat", currentChatId);
    }

    logTime("Leave previous chat", leaveStart);

    // 2. Start or retrieve conversation
    const chatStartTime = performance.now();

    console.log("[CHAT] Calling POST /api/chat/start");

    const { data } = await axios.post(
      `${BACKEND_URL}/api/chat/start`,
      { receiverId },
      { withCredentials: true }
    );

    logTime("POST /api/chat/start", chatStartTime);

    if (chatRequestIdRef.current !== requestId) {
      console.warn("[CHAT] Stale request after chat start");
      return;
    }

    const chat = data.chat ?? data;
    const chatId = chat._id ?? data.chatId;

    if (!chatId) {
      throw new Error("Chat ID missing from API response");
    }

    console.log("[CHAT] Chat initialized", {
      chatId,
      status: chat.status,
    });

    setCurrentChatId(chatId);
    setRequestedUser(chat);
    setActiveChatStatus(chat.status);

    // 3. Join Socket.IO chat room
    const socketStart = performance.now();

    if (socket) {
      socket.emit("join_chat", chatId);
    }

    logTime("Socket join emit", socketStart);

    // 4. Fetch message history from backend
    const fetchStart = performance.now();

    console.log("[CHAT] Fetching message history", {
      chatId,
      limit: CHAT_PAGE_SIZE,
    });

    const { data: messagesData } = await axios.get(
      `${BACKEND_URL}/api/messages/${chatId}`,
      {
        params: { limit: CHAT_PAGE_SIZE },
        withCredentials: true,
      }
    );

    logTime("GET /api/messages/:chatId", fetchStart);

    if (chatRequestIdRef.current !== requestId) {
      console.warn("[CHAT] Stale request after history fetch");
      return;
    }

    const backendMessages = messagesData.messages || [];

    console.log("[CHAT] Backend history response", {
      count: backendMessages.length,
      e2eeCount: backendMessages.filter(
        (msg: Message) => Boolean(msg.e2eeMessageId)
      ).length,
      nextCursor: messagesData.nextCursor ?? null,
    });

    // 5. Restore decrypted messages from IndexedDB
    const hydrationStart = performance.now();

    console.log("[CHAT] IndexedDB hydration started");

    const restoredMessages = await hydrateMessagesFromLocalStore(
      backendMessages,
      currentUser!
    );

    logTime("IndexedDB hydration", hydrationStart);

    if (chatRequestIdRef.current !== requestId) {
      console.warn("[CHAT] Stale request after hydration");
      return;
    }

    const restoredCount = restoredMessages.filter(
      (msg: Message) => Boolean(msg.text)
    ).length;

    console.log("[CHAT] Hydration completed", {
      totalMessages: restoredMessages.length,
      messagesWithText: restoredCount,
      messagesWithoutText: restoredMessages.length - restoredCount,
    });

    // 6. Update React conversation state
    const stateStart = performance.now();

    setConversations((prev) => ({
      ...prev,
      [receiverId]: restoredMessages,
    }));

    logTime("React state update scheduled", stateStart);

    // Keep your existing pagination and markChatAsSeen logic here.

    logTime("TOTAL chat initialization", startedAt);

    console.log("[CHAT] Initialization completed successfully");
  } catch (error) {
    console.error("[CHAT] Initialization failed:", error);
    logTime("FAILED after", startedAt);

    toast.error("Failed to initialize conversation");
  } finally {
    if (chatRequestIdRef.current === requestId) {
      setIsChatInitializing(false);
    }

    console.groupEnd();
  }
};

  const handleUpdateChatStatus = async (status: "accepted" | "declined") => {
    if (!currentChatId) return;
    setStatusLoading(status);
    try {
      const endpoint = status === "accepted" ? "accept" : "reject";

      await axios.put(`${BACKEND_URL}/api/chat-requests/${currentChatId}/${endpoint}`, {}, { withCredentials: true });

      setActiveChatStatus(status);
      setUsers((prev) => prev.map((u) => (u.id === activeUser?.id ? { ...u, chatStatus: status } : u)));
    } catch (err) {
      console.error(err);
      toast.error("Failed to update request");
    } finally {
      setStatusLoading(null);
    }
  };




const handleSendMessage = async () => {
  const content = message.trim();

  if (!currentUser || !activeChat || !content) return;
  if (!canSendMessages) return;

  if (isChatInitializing) {
    toast.info("Please wait, conversation is loading...");
    return;
  }

  if (!currentChatId) {
    toast.error("Chat is not initialized yet.");
    return;
  }

  // Capture the current conversation before starting async work.
  const recipientId = activeChat;
  const chatId = currentChatId;
  const senderId = currentUser;
  const tempId = crypto.randomUUID();

  const replyTo = replyingTo?._id
    ? {
        messageId: replyingTo._id,
        senderId: replyingTo.senderId,
        text: replyingTo.text || null,
        messageType: replyingTo.messageType || "text",
        mediaType: replyingTo.mediaType || null,
      }
    : null;

  const optimisticMessage: Message = {
    tempId,
    chatId,
    senderId,
    receiverId: recipientId,
    text: content,
    messageType: "text",
    createdAt: new Date(),
    replyTo,
    seen: false,
  };

  // 1. Show the message immediately.
  setConversations((prev) => ({
    ...prev,
    [recipientId]: [
      ...(prev[recipientId] || []),
      optimisticMessage,
    ],
  }));

  // Clear the input immediately.
  setMessage("");
  setReplyingTo(null);

  let stage = "E2EE initialization";

  try {
    const client = await getE2EEClient(senderId, 1);

    stage = "E2EE send";

    const payload = {
      type: "text",
      chatId,
      text: content,
      replyTo,
    };

    const result = await client.send(
      recipientId,
      JSON.stringify(payload),
      {
        clientMessageId: tempId,
        timestamp: Date.now(),
        replyTo: replyTo?.messageId,
      }
    );

    console.log("[E2EE] Send result:", result);

    // 2. Update the optimistic message with its E2EE ID.
    setConversations((prev) => ({
      ...prev,
      [recipientId]: (prev[recipientId] || []).map((msg) =>
        msg.tempId === tempId
          ? {
              ...msg,
              e2eeMessageId: result.messageId,
              createdAt: new Date(
                Number(result.timestamp) || Date.now()
              ),
            }
          : msg
      ),
    }));

    // 3. Save the sender's local decrypted copy.
    try {
      await saveDecryptedMessage({
        userId: senderId,
        e2eeMessageId: result.messageId,
        chatId,
        senderId,
        receiverId: recipientId,
        type: "text",
        text: content,
        timestamp: Number(result.timestamp) || Date.now(),
        replyTo: replyTo ?? null,
      });
    } catch (storageError) {
      console.error(
        "[E2EE] Failed to save sender's local message:",
        storageError
      );
    }

    // 4. Persist metadata independently.
    stage = "Save message metadata";

    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/messages/e2ee/metadata`,
        {
          chatId,
          e2eeMessageId: result.messageId,
          senderId,
          receiverId: recipientId,
          messageType: "text",
          replyTo,
          timestamp: result.timestamp,
        },
        { withCredentials: true }
      );

      const mongoMessageId = response.data?.data?._id;

      if (mongoMessageId) {
        setConversations((prev) => ({
          ...prev,
          [recipientId]: (prev[recipientId] || []).map((msg) =>
            msg.tempId === tempId
              ? {
                  ...msg,
                  _id: mongoMessageId,
                  e2eeMessageId: result.messageId,
                }
              : msg
          ),
        }));
      }

      console.log("[E2EE] Metadata saved:", response.data);
    } catch (metadataError) {
      // The encrypted message was already sent.
      // Do not remove it just because metadata persistence failed.
      console.error(
        "[E2EE] Metadata persistence failed:",
        metadataError
      );

      toast.warning(
        "Message sent, but message history is still syncing."
      );
    }
  } catch (error) {
    console.error(`[E2EE] Failed at stage: ${stage}`, error);

    // Remove the optimistic message if the send itself failed.
    setConversations((prev) => ({
      ...prev,
      [recipientId]: (prev[recipientId] || []).filter(
        (msg) => msg.tempId !== tempId
      ),
    }));

    // Restore the text if the user hasn't typed another message.
    setMessage((prev) => prev || content);

    toast.error(`Message failed during: ${stage}`);
  }
};



  const handleReply = (message: Message) => {
    if (!message?._id && !message?.tempId) return;

    if (!message._id) {
      toast.info("Please wait for the message to be sent before replying.");
      return;
    }

    setReplyingTo(message);
    setShowEmojiPicker(false);
  };

  const handleDeleteMessage = (messageId: string) => {
    if (!socket) return;

    socket.emit("delete-message", { messageId });

    setOpenMenuId(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getUnreadCount = () => Object.values(unreadCounts).reduce((a, b) => a + b, 0);
  const filteredUsers = users
    .filter((u) => u.id !== currentUser)
    .filter((u) => u.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const activeUser = users.find((u) => u.id === activeChat);
  const isSender = requestedUser ? requestedUser.requestedBy === currentUser : true;

  const canSendMessages = isSender || activeChatStatus === "accepted";

  const toggleOpen = () => {
    setIsOpen(true);
    setIsMinimized(false);
    setIsMaximized(false);
  };

  const toggleClose = () => {
    if (currentChatId && socket) {
      socket.emit("leave_chat", currentChatId);
    }

    setIsOpen(false);
    setIsMinimized(false);
    setIsMaximized(false);
    setActiveChat(null);
    setCurrentChatId(null);
  };

  const toggleMaximize = () => {
    setIsMaximized((prev) => !prev);
  };

  const handleRestore = () => {
    setIsMaximized(false);
    setIsMinimized(false);
  };

  const toggleModal = () => {
    setIsOpen(true);
    setIsMinimized(false);
    setIsMaximized(false);
  };

  const leftSpacer = isMaximized && (
    <div className="w-14 shrink-0 border-r border-white/10" />
  );

  return (
    <>
      {/* 1. Toggle Button - Use isVisible here */}
      <div
        className={`fixed z-50 bottom-6 right-6 transition-all duration-300 ease-in-out origin-center ${isVisible ? "opacity-0 scale-50 pointer-events-none" : "opacity-100 scale-100"
          }`}
      >
        <ChatToggleButton unreadCount={getUnreadCount()} onClick={toggleOpen} />
      </div>

      <input
        type="file"
        accept="image/*,video/*"
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* 2. Chat Window - Use isVisible here for the opacity/scale classes */}
      {isRendered && (
        <div
          className={`fixed z-50 flex flex-col overflow-hidden transition-all duration-300 ease-in-out origin-bottom-right
      ${isVisible ? "opacity-100 scale-100" : "opacity-0 scale-50 pointer-events-none"}
      ${isMaximized
              ? "bottom-0 right-0 w-full h-full rounded-none"
              : "bottom-6 right-6 w-80 rounded-lg border border-white/10 shadow-lg"
            } 
      ${isMinimized ? "h-16" : isMaximized ? "h-full" : "h-96"}
    `}
          style={{
            backgroundImage:
              "radial-gradient(150% 150% at 0% 0%, #000000 0%, #000000 20%, #141b2e 100%)",
          }}
        >
          <ChatHeader
            isMinimized={isMinimized}
            isMaximized={isMaximized}
            usersCount={users.length}
            onRestore={handleRestore}
            onMinimizedActionClick={toggleModal}
            onToggleMaximize={toggleMaximize}
            onClose={toggleClose}
          />

          {!isMinimized && (
            <div className="w-full flex-1 flex flex-col min-h-0 overflow-hidden">
              {!activeChat ? (
                <div
                  className={`flex w-full h-full overflow-hidden ${isMaximized ? "max-w-[1920px] mx-auto" : "flex-col"
                    }`}
                >
                  {leftSpacer}
                  <div className={`${isMaximized ? "w-80 border border-white/20 flex flex-col overflow-hidden" : "w-full flex flex-col overflow-hidden min-h-0"}`}>
                    <UsersListPanel
                      isMaximized={isMaximized}
                      isSidebarVariant={false}
                      loading={loading}
                      filteredUsers={filteredUsers}
                      searchTerm={searchTerm}
                      onSearchChange={setSearchTerm}
                      onUserClick={handleUserClick}
                      unreadCounts={unreadCounts}
                      onlineUsers={onlineUsers}
                    />
                  </div>

                  {isMaximized && (
                    <div className="flex-1 flex items-center justify-center overflow-hidden">
                      <div className="text-center text-white/80">
                        <MessageCircle size={48} className="mx-auto mb-4 text-white/60" />
                        <h3 className="text-xl font-semibold mb-2">Welcome to Messages</h3>
                        <p className="text-white/60">Select a conversation to start messaging</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  className={`flex w-full h-full overflow-hidden ${isMaximized ? "max-w-[1920px] mx-auto" : "flex-col"
                    }`}
                >
                  {leftSpacer}
                  {isMaximized && (
                    <aside className="w-80 border border-white/20 flex flex-col overflow-hidden">
                      <UsersListPanel
                        isMaximized={isMaximized}
                        isSidebarVariant
                        activeChat={activeChat}
                        loading={loading}
                        filteredUsers={filteredUsers}
                        searchTerm={searchTerm}
                        onSearchChange={setSearchTerm}
                        onUserClick={handleUserClick}
                        unreadCounts={unreadCounts}
                        onlineUsers={onlineUsers}
                      />
                    </aside>
                  )}

                  <div className="flex-1 flex flex-col min-h-0 h-full overflow-hidden">
                    <ChatMessageList
                      isMaximized={isMaximized}
                      messages={conversations[activeChat] || []}
                      currentUser={currentUser}
                      openMenuId={openMenuId}
                      onToggleMenu={(id) => setOpenMenuId(openMenuId === id ? null : id)}
                      onDeleteMessage={handleDeleteMessage}
                      onReply={handleReply}
                      onMediaClick={setMediaViewer}
                      onReplyPreviewClick={handleReplyPreviewClick}
                      activeChatStatus={activeChatStatus}
                      requestedByCurrentUser={requestedUser?.requestedBy === currentUser}
                      activeUserName={activeUser?.name}
                      statusLoading={statusLoading}
                      onAcceptChat={() => handleUpdateChatStatus("accepted")}
                      onDeclineChat={() => handleUpdateChatStatus("declined")}
                      messagesEndRef={messagesEndRef}
                      hasMore={chatHasMore[activeChat] ?? false}
                      loadingMore={loadingOlderMessages[activeChat] ?? false}
                      onLoadMore={loadOlderMessages}
                      currentChatId={currentChatId}
                    />

                    <ChatInput
                      isMaximized={isMaximized}
                      isChatInitializing={isChatInitializing}
                      currentChatId={currentChatId}
                      message={message}
                      onMessageChange={setMessage}
                      onSend={handleSendMessage}
                      onKeyPress={handleKeyPress}
                      canSendMessages={canSendMessages}
                      activeUserName={activeUser?.name}
                      onFileButtonClick={() => fileInputRef.current?.click()}
                      replyingTo={replyingTo}
                      onCancelReply={() => setReplyingTo(null)}
                      showEmojiPicker={showEmojiPicker}
                      onToggleEmojiPicker={() => setShowEmojiPicker(!showEmojiPicker)}
                      onEmojiClick={onEmojiClick}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {mediaViewer && (
        <MediaViewer
          assets={[{ url: mediaViewer.url, type: mediaViewer.type }]}
          startIndex={0}
          onClose={() => setMediaViewer(null)}
        />
      )}
    </>
  );
};

export default MessagingComponent;