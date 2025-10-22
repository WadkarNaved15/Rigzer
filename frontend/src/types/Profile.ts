export interface ProfileData {
  // Basic info
  _id?: string; // from MongoDB
  username: string;
  name: string;
  profession?: string;
  bio?: string;
  location?: string;

  // Contact
  email: string;
  phone?: string;

  // Social links
  github?: string;
  linkedin?: string;
  website?: string;

  // Skills
  skills: string[];

  // Follow system
  followersCount?: number;
  followingCount?: number;
  isFollowing?: boolean; // if current user follows this profile

  // Media
  avatarUrl?: string;
  bannerUrl?: string;

  // Meta
  createdAt?: string;
  updatedAt?: string;
}
