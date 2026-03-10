import type { PostProps } from "../types/Post";
import type { ArticleProps } from "../types/Article";

export interface ProfileUser {
  _id: string;
  username: string;
  avatar?: string;
  banner?: string;
  bio?: string;
  socials?: {
    twitter?: string;
    youtube?: string;
    instagram?: string;
    steam?: string;
    discord?: string;
  };
}

interface CachedProfileState {
  profileUser: ProfileUser;
  posts: PostProps[];
  cursor: string | null;
  hasMore: boolean;
  articles: ArticleProps[];
  scrollY: number;
  savedAt: number; // timestamp for TTL
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 20;           // max 20 profiles in memory

const cache = new Map<string, CachedProfileState>();

export const saveProfileCache = (username: string, state: Omit<CachedProfileState, "savedAt">) => {
  // Evict oldest entry if at capacity
  if (cache.size >= MAX_CACHE_SIZE && !cache.has(username)) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(username, { ...state, savedAt: Date.now() });
};

export const getProfileCache = (username: string): CachedProfileState | null => {
  const entry = cache.get(username);
  if (!entry) return null;

  // Invalidate stale cache
  if (Date.now() - entry.savedAt > CACHE_TTL_MS) {
    cache.delete(username);
    return null;
  }

  return entry;
};

export const clearProfileCache = (username: string) => {
  cache.delete(username);
};