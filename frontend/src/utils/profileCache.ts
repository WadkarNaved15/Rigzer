import type { PostProps } from "../types/Post";
import type { ArticleProps } from "../types/Article";

interface ProfileUser {
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
  profileUser: ProfileUser;       // ← ADD THIS
  posts: PostProps[];
  cursor: string | null;
  hasMore: boolean;
  articles: ArticleProps[];
  scrollY: number;
}

const cache = new Map<string, CachedProfileState>();

export const saveProfileCache = (username: string, state: CachedProfileState) => {
  cache.set(username, state);
};

export const getProfileCache = (username: string): CachedProfileState | null => {
  return cache.get(username) ?? null;
};

export const clearProfileCache = (username: string) => {
  cache.delete(username);
};