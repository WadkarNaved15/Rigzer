// types/post.ts

export type PostType = 'normal_post' | 'game_post' | 'exe_post';

export interface UserSummary {
  _id: string;
  username: string;
  email: string;
  avatarUrl?: string;
}

// Base structure
interface CommonPostFields {
  _id: string;
  type: PostType;
  user: UserSummary;
  avatarUrl?: string;
  description: string;
  media: string[];
  createdAt: string;
  updatedAt: string;
  likes?: number;
  comments?: number;
}

// Specific post types
export interface NormalPostProps extends CommonPostFields {
  type: 'normal_post';
  gameUrl?: string; // Optional for normal
}

export interface GamePostProps extends CommonPostFields {
  type: 'game_post';
  gameUrl: string;
}

export interface ExePostProps extends CommonPostFields {
  type: 'exe_post';
  gameUrl: string;
}

export type PostProps = NormalPostProps | GamePostProps | ExePostProps;
