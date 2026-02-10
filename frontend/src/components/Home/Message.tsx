import React, { useState, useRef, useEffect } from "react";
import { useSocket } from "../../context/SocketContext";
import EmojiPicker from 'emoji-picker-react';
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Header } from "../Header"; // 1. Add your import
import SharedPostMessage from "./SharedPostMessage";
import { useUser } from "../../context/user";
import { useUI } from "../../context/UIContext";
import { useUsers } from "../../context/UsersContext";
import { toast } from "react-toastify";
import {
  MessageCircle,
  X,
  Send,
  Minus,
  Paperclip,
  Smile,
  Search,
  ArrowLeft,
  Maximize2,
  Square,
} from "lucide-react";
interface ApiUser {
  _id: string;
  username: string;
}
interface User {
  _id: string,
  id: string;
  name: string;
  avatar: string;
  unreadCount: number;
  status?: string;
  lastSeen?: string;
}
type UploadAsset = {
  file: File;
  type: "image" | "video" | "misc";
};
type Message = any
type ChatId = string;
const MessagingComponent = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [message, setMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeChat, setActiveChat] = useState<ChatId | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentChatId, setCurrentChatId] = useState(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { isAdPlaying } = useUI();
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useUser();
  const { users, loading } = useUsers();
  const currentUser = user?._id;
  const navigate = useNavigate();
  const socket = useSocket();
  if (isAdPlaying) {
    return null;
  }
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
      // Ensure the cleanup returns void
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    };
  }, []);
  // const socket = io( `${BACKEND_URL}`, {
  //   withCredentials: true,
  // });
  const [conversations, setConversations] = useState<
    Record<string, Message[]>
  >({});
  const uploadChatMediaToS3 = async (
    asset: UploadAsset,
    onProgress: (percent: number) => void
  ): Promise<string> => {
    // 1️⃣ Get presigned URL
    const res = await fetch(`${BACKEND_URL}/api/upload/presigned-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        fileName: asset.file.name,
        fileType: asset.file.type,
        category: asset.type,
      }),
    });

    if (!res.ok) {
      throw new Error("Failed to get presigned URL");
    }

    const { uploadUrl, fileUrl } = await res.json();

    // 2️⃣ Upload to S3 with REAL progress
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
          resolve(fileUrl);
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      };

      xhr.onerror = () => reject(new Error("Upload network error"));

      xhr.send(asset.file);
    });
  };
  const onEmojiClick = (emojiData: { emoji: string }) => {
    setMessage((prev) => prev + emojiData.emoji);
  };
  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => scrollToBottom(), [conversations, activeChat]);





  useEffect(() => {
    if (!socket || !currentUser) return;
    const handler = (msg: any) => {
      if (!currentUser) return;

      if (msg.senderId === currentUser && !msg.tempId) return;

      const otherUserId =
        msg.senderId === currentUser ? msg.receiverId : msg.senderId;

      setConversations((prev) => ({
        ...prev,
        [otherUserId]: [...(prev[otherUserId] || []), msg],
      }));
    };

    socket.on("receive-message", handler);

    return () => {
      socket.off("receive-message", handler);
    };
  }, [currentUser]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!socket || !currentUser) return;
    const file = e.target.files?.[0];
    if (!file || !currentChatId || !activeChat || !currentUser) return;

    const toastId = toast.loading("Uploading... 0%");

    try {
      const fileUrl = await uploadChatMediaToS3(
        {
          file,
          type: file.type.startsWith("image")
            ? "image"
            : file.type.startsWith("video")
              ? "video"
              : "misc",
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

      // Send chat message
      const newMessage = {
        chatId: currentChatId,
        senderId: currentUser,
        receiverId: activeChat,
        text: "",
        mediaUrl: fileUrl,
        mediaType: file.type.startsWith("image")
          ? "image"
          : file.type.startsWith("video")
            ? "video"
            : "misc",

        createdAt: new Date(),
      };

      socket.emit("send-message", newMessage);

      // Optimistic UI
      setConversations((prev) => ({
        ...prev,
        [activeChat]: [...(prev[activeChat] || []), newMessage],
      }));
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


  const handleUserClick = async (receiverId: string) => {
    try {
      setActiveChat(receiverId);
      // console.log("receiverId", receiverId);
      // Hit backend to create or get the chat
      const { data } = await axios.post(
        `${BACKEND_URL}/api/chat/start`,
        { receiverId },
        { withCredentials: true }
      );

      setCurrentChatId(data._id);

      // Fetch previous messages for this chat
      const messagesResponse = await axios.get(`${BACKEND_URL}/api/messages/${data._id}`, {
        withCredentials: true,
      });

      setConversations((prev) => ({
        ...prev,
        [receiverId]: messagesResponse.data,
      }));
    } catch (error) {
      console.error("Error starting chat:", error);
    }
  };

  const handleSendMessage = () => {
    if (!socket || !currentUser) return;
    if (!message.trim() || !activeChat) return;
    const tempId = Date.now(); // unique temporary ID
    const newMessage = {
      tempId,
      chatId: currentChatId,
      senderId: currentUser ? currentUser : null,
      receiverId: activeChat,
      text: message,
      createdAt: new Date(),
    };

    // emit to server
    socket.emit("send-message", newMessage);

    // optimistic update
    setConversations((prev) => ({
      ...prev,
      [activeChat]: [...(prev[activeChat] || []), newMessage],
    }));

    setMessage("");
  };



  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };


  const formatTime = (ts: Date) => ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const getUnreadCount = () => users.reduce((t, u) => t + (u.unreadCount || 0), 0);
  const filteredUsers = users.filter((u) => u.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const activeUser = users.find((u) => u.id === activeChat);

  const toggleOpen = () => {
    setIsOpen(true);
    setIsMinimized(false);
    setIsMaximized(false);
  };

  const toggleClose = () => {
    setIsOpen(false);
    setIsMinimized(false);
    setIsMaximized(false);
    setActiveChat(null);
  };

  const toggleMinimize = () => {
    setIsMinimized(true);
  };

  const toggleMaximize = () => {
    setIsMaximized(prev => !prev);
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

  return (
    <div className={`fixed z-50 ${isMaximized ? "inset-0" : "bottom-6 right-6"}`}>
      {/* Floating Button (visible when not open) */}
      {!isOpen && (
        <button
          onClick={toggleOpen}
          className="
    bg-gradient-to-br
   from-gray-400 to-gray-800
  hover:from-gray-500 hover:to-gray-900

    dark:from-[#3D7A6E] dark:to-black
    dark:hover:from-[#182421] dark:hover:to-teal-900

    text-white
    p-4 rounded-full shadow-lg
    transition-all duration-300 transform
    hover:scale-110
    group relative
  "
        >
          <MessageCircle
            size={24}
            className="group-hover:animate-pulse text-white"
          />

          {getUnreadCount() > 0 && (
            <div
              className="
        absolute -top-2 -right-2
        bg-red-500 text-white text-xs
        rounded-full h-5 w-5 flex items-center justify-center
        animate-pulse
      "
            >
              {getUnreadCount()}
            </div>
          )}
        </button>


      )}
      <input
        type="file"
        accept="image/*,video/*"
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
      />


      {/* Chat Window */}
      {isOpen && (
        <div
          className={`${isMaximized
            ? "w-full h-full bg-gradient-to-br from-gray-500 via-gray-400 to-gray-600 dark:from-gray-900 dark:via-black dark:to-gray-800 flex flex-col"
            : "relative bg-white dark:bg-black w-80 border border-gray-200 shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md rounded-lg flex flex-col"
            } ${isMinimized ? "h-16" : isMaximized ? "h-full" : "h-96"}`}
        >
        {/* {isMaximized && <Header />} */}
          {/* Header */}
          <div
            className={`flex-shrink-0 h-16 ${isMaximized
              ? "bg-white/10 backdrop-blur-xl border-b border-white/20 text-white"
              : "bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700"
              } p-4 flex items-center justify-between`}
          >
            {isMinimized ? (
              // Minimized Header
              <>
                <div className="flex items-center space-x-3 cursor-pointer" onClick={handleRestore}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-200 dark:bg-gray-700">
                    <MessageCircle size={16} className="text-gray-600 dark:text-gray-300" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">Messages</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{users.length} contacts</p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={isMinimized ? toggleModal : toggleMaximize}
                    className="hover:bg-gray-200 dark:hover:bg-gray-700 p-1 rounded"
                  >
                    {isMaximized ? <Square size={16} /> : <Maximize2 size={16} />}
                  </button>
                  <button
                    onClick={toggleClose}
                    className="hover:bg-gray-200 dark:hover:bg-gray-700 p-1 rounded"
                  >
                    <X size={16} />
                  </button>
                </div>
              </>
            ) : (
              // Full/Maximized Header
              <>
                <div className="flex items-center space-x-3">
                  {activeChat && (
                    <button onClick={() => setActiveChat(null)} className="hover:bg-white/20 p-1 rounded">
                      <ArrowLeft size={16} />
                    </button>
                  )}
                  <div
                    className={`${isMaximized
                      ? "w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white"
                      : "w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300"
                      }`}
                  >
                    {activeUser ? activeUser.avatar : <MessageCircle size={16} />}
                  </div>
                  <div>
                    <h3
                      className={`font-semibold text-sm ${isMaximized ? "text-white" : "text-gray-900 dark:text-white"
                        }`}
                    >
                      {activeUser ? activeUser.name : "Messages"}
                    </h3>
                    <p
                      className={`text-xs ${isMaximized ? "text-white/80" : "text-gray-500 dark:text-gray-400"
                        }`}
                    >
                      {activeUser ? activeUser.lastSeen : `${users.length} contacts`}
                    </p>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={toggleMaximize}
                    className={`p-1 rounded ${isMaximized ? "hover:bg-white/20" : "hover:bg-gray-200 dark:hover:bg-gray-700"
                      }`}
                  >
                    {isMaximized ? <Square size={16} /> : <Maximize2 size={16} />}
                  </button>

                  {!isMaximized && (
                    <button
                      onClick={toggleMinimize}
                      className="hover:bg-gray-200 dark:hover:bg-gray-700 p-1 rounded"
                    >
                      <Minus size={16} />
                    </button>
                  )}

                  <button
                    onClick={toggleClose}
                    className={`p-1 rounded ${isMaximized ? "hover:bg-white/20" : "hover:bg-gray-200 dark:hover:bg-gray-700"
                      }`}
                  >
                    <X size={16} />
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Body */}
          {!isMinimized && (
            <div className="w-full flex-1 flex overflow-hidden">
              {!activeChat ? (
                <div className={`flex w-full ${isMaximized ? "max-w-6xl mx-auto" : "flex-col"}`}>
                  <div className={`${isMaximized ? "w-80 border-r border-white/20 flex flex-col" : "w-full flex flex-col"}`}>
                    {/* Search */}
                    <div className={`p-4 border-b ${isMaximized ? "border-white/20" : "border-gray-200 dark:border-gray-700"} flex-shrink-0`}>
                      <div className="relative">
                        <Search
                          size={18}
                          className={`absolute left-3 top-2.5 ${isMaximized ? "text-white/60" : "text-gray-400 dark:text-gray-500"
                            }`}
                        />
                        <input
                          type="text"
                          placeholder="Search conversations..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className={`w-full pl-10 pr-4 py-2 rounded-lg text-sm focus:outline-none ${isMaximized
                            ? "bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-white/60 focus:ring-2 focus:ring-white/40"
                            : "border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-gray-400"
                            }`}
                        />
                      </div>
                    </div>

                    {/* Users List */}
                    <div className="flex-1 overflow-y-auto">
                      {filteredUsers.map((u) => (
                        <div
                          key={u.id}
                          onClick={() => handleUserClick(u.id)}
                          className={`flex items-center p-4 cursor-pointer transition-colors border-b ${isMaximized
                            ? "hover:bg-white/10 border-white/10"
                            : "hover:bg-gray-50 dark:hover:bg-gray-900 border-gray-100 dark:border-gray-800"
                            }`}
                        >
                          <div className="relative">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm ${isMaximized
                                ? "bg-gradient-to-r from-pink-400 to-purple-400 text-white"
                                : "bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200"
                                }`}
                            >
                              {u.avatar}
                            </div>
                            <div
                              className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 ${isMaximized ? "border-white" : "border-white dark:border-black"
                                } ${u.status === "online" ? "bg-green-400" : "bg-gray-300 dark:bg-gray-600"}`}
                            />
                          </div>
                          <div className="ml-3 flex-1">
                            <div className="flex items-center justify-between">
                              <h4 className={`${isMaximized ? "text-white" : "text-gray-900 dark:text-white"} font-semibold text-sm`}>{u.name}</h4>
                              {u.unreadCount > 0 && (
                                <div
                                  className={`text-xs rounded-full h-5 w-5 flex items-center justify-center ${isMaximized ? "bg-pink-500 text-white" : "bg-gray-600 dark:bg-gray-400 text-white dark:text-black"
                                    }`}
                                >
                                  {u.unreadCount}
                                </div>
                              )}
                            </div>
                            <p className={`${isMaximized ? "text-white/70" : "text-gray-500 dark:text-gray-400"} text-xs mt-1`}>{u.lastSeen}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Welcome Screen for Maximized View */}
                  {isMaximized && (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="text-center text-white/80">
                        <MessageCircle size={48} className="mx-auto mb-4 text-white/60" />
                        <h3 className="text-xl font-semibold mb-2">Welcome to Messages</h3>
                        <p className="text-white/60">Select a conversation to start messaging</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                // Chat View
                <div className={`flex w-full ${isMaximized ? "max-w-6xl mx-auto" : "flex-col"}`}>
                  {/* Sidebar for Maximized Chat View */}
                  {isMaximized && (
                    <aside className="w-80 border-r border-white/20 flex flex-col">
                      {/* Search */}
                      <div className="p-4 border-b border-white/20 flex-shrink-0">
                        <div className="relative">
                          <Search size={18} className="absolute left-3 top-2.5 text-white/60" />
                          <input
                            type="text"
                            placeholder="Search conversations..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-white/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/40 focus:border-transparent text-sm"
                          />
                        </div>
                      </div>

                      {/* Users List */}
                      <div className="flex-1 overflow-y-auto">
                        {filteredUsers.map((u) => (
                          <div
                            key={u.id}
                            onClick={() => setActiveChat(u.id)}
                            className={`flex items-center p-4 cursor-pointer transition-colors border-b border-white/10 ${activeChat === u.id ? "bg-white/20" : "hover:bg-white/10"
                              }`}
                          >
                            <div className="relative">
                              <div className="w-10 h-10 bg-gradient-to-r from-pink-400 to-purple-400 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                                {u.avatar}
                              </div>
                              <div
                                className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${u.status === "online" ? "bg-green-400" : "bg-gray-300"
                                  }`}
                              />
                            </div>
                            <div className="ml-3 flex-1">
                              <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-sm text-white">{u.name}</h4>
                                {u.unreadCount > 0 && activeChat !== u.id && (
                                  <div className="bg-pink-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                                    {u.unreadCount}
                                  </div>
                                )}
                              </div>
                              <p className="text-xs text-white/70 mt-1">{u.lastSeen}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </aside>
                  )}

                  {/* Chat Area */}
                  <div className="flex-1 flex flex-col">
                    {/* Messages */}
                    <main
                      className={`flex-1 overflow-y-auto p-4 space-y-3 ${isMaximized ? "bg-black/20 backdrop-blur-sm" : "bg-gray-50 dark:bg-gray-900"
                        }`}
                    >
                      {(conversations[activeChat] || []).map((msg) => (
                        <div
                          key={msg._id || msg.tempId || msg.id}
                          className={`flex ${msg.senderId === currentUser ? "justify-end" : "justify-start"
                            }`}
                        >
                          <div
                            className={`max-w-xs px-3 py-2 rounded-lg text-sm shadow-sm ${msg.senderId === currentUser
                              ? "bg-gray-600 text-white"
                              : "bg-gray-200 text-black"
                              }`}
                          >

                            {/* IMAGE */}
                            {msg.mediaType === "image" && (
                              <img
                                src={msg.mediaUrl}
                                crossOrigin="anonymous"
                                alt="media"
                                className="rounded-lg max-w-full mb-2"
                              />
                            )}

                            {/* VIDEO */}
                            {msg.mediaType === "video" && (
                              <video
                                src={msg.mediaUrl}
                                crossOrigin="anonymous"
                                controls
                                className="rounded-lg max-w-full mb-2"
                              />
                            )}

                            {/* TEXT */}
                            {msg.text && <p>{msg.text}</p>}
                            {/* POST */}
                            {msg.messageType === "post" && (
                              <SharedPostMessage
                                postId={msg.sharedPostId}
                                onOpenPost={(postId: string) => {
                                  window.open(`/?post=${postId}`, '_blank', 'noopener,noreferrer');
                                }}
                              />
                            )}
                            {/* TIME */}
                            <p className="text-xs mt-1 text-gray-500">
                              {new Date(msg.createdAt).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      ))}



                      <div ref={messagesEndRef} />
                    </main>

                    {/* Input */}
                    <footer
                      className={`flex-shrink-0 p-4 border-t ${isMaximized
                        ? "border-white/20 bg-black/20 backdrop-blur-xl"
                        : "border-gray-200 dark:border-gray-700 bg-white dark:bg-black"
                        }`}
                    >
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className={`${isMaximized
                            ? "text-white/60 hover:text-white"
                            : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                            } transition-colors`}
                        >
                          <Paperclip size={18} />
                        </button>

                        <div className="flex-1 relative">
                          {/* The Emoji Picker Popover */}
                          {showEmojiPicker && (
                            <div className="absolute bottom-full mb-2 right-0 z-50">
                              <EmojiPicker
                                onEmojiClick={onEmojiClick}
                                height={400}
                              />
                            </div>
                          )}
                          <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder={`Message ${activeUser?.name || ""}...`}
                            className={`w-full p-2 rounded-lg resize-none focus:outline-none focus:ring-2 focus:border-transparent text-sm ${isMaximized
                              ? "bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-white/60 focus:ring-white/40"
                              : "border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-gray-400"
                              }`}
                            rows={1}
                            style={{ minHeight: "36px", maxHeight: "80px" }}
                          />
                        </div>
                        <button
                          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                          className={`${isMaximized
                            ? "text-white/60 hover:text-white"
                            : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                            } transition-colors`}
                        >
                          <Smile size={18} />
                        </button>
                        <button
                          onClick={handleSendMessage}
                          disabled={!message.trim()}
                          className={`p-2 rounded-lg transition-all disabled:cursor-not-allowed ${isMaximized
                            ? "bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 disabled:from-gray-500 disabled:to-gray-500 text-white"
                            : "bg-gray-600 dark:bg-gray-400 hover:bg-gray-700 dark:hover:bg-gray-300 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white dark:text-black"
                            }`}
                        >
                          <Send size={16} />
                        </button>
                      </div>
                    </footer>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MessagingComponent;