export interface ChatUser {
  id: string;
  name: string;
  avatar: string;
  unreadCount: number;
  status?: string;
  lastSeen?: string;
  chatStatus?: string;
}

export type MessageType = "text" | "media" | "post";

export type MediaType = "image" | "video" | null;

export interface ReplyTo {
  messageId: string;
  senderId: string;
  text: string | null;
  messageType: MessageType;
  mediaType: MediaType;
  mediaUrl?: string | null;
}

export interface Message {
  _id?: string;
  id?: string;
  clientId?: string;
  tempId?: string | number;

  chatId: string | null;
  e2eeMessageId?: string;

  senderId: string;
  receiverId: string;

  text: string;


  mediaUrl?: string | null;
  mediaKey?: string | null;
  mediaType?: MediaType;

  messageType: MessageType;

  sharedPostId?: string | null;

  replyTo?: ReplyTo | null;

  seen?: boolean;
  seenAt?: string | null;

  createdAt: string | Date;
}

export type ChatId = string;

export interface MediaViewerState {
  url: string;
  type: "image" | "video";
}