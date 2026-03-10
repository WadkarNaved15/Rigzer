// src/types/Post.ts

export type PostType =
  | 'normal_post'
  | 'game_post'
  | 'model_post'
  | 'devlog_post'
  | 'ad_model_post'
  | 'pocket_update'   // feed.service.js sets feedType: "pocket_update" on normalised entries

export interface UserSummary {
  _id: string;
  username: string;
  email: string;
  avatar?: string;
}

export interface ModelMetadata {
  fileName: string;
  downloadSizeMB: number;
  geometry: { meshes: number; vertices: number; triangles: number };
  materials: number;
  textures: { present: boolean; count: number };
  uvLayers: number;
  vertexColors: boolean;
  animations: { present: boolean; count: number };
  rigged: boolean;
  morphTargets: boolean;
  transforms: {
    scale: [number, number, number];
    position: [number, number, number];
    rotation: { values: [number, number, number]; order: 'XYZ' | 'XZY' | 'YXZ' | 'YZX' | 'ZXY' | 'ZYX' };
  };
  boundingBox: { width: number; height: number; depth: number };
  center: { x: number; y: number; z: number };
}

export interface NormalPostAsset {
  name: string;
  url: string;
  type: 'image' | 'video';
}

export interface OptimizationInfo {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  optimizedSizeMB?: number;
  compressionRatio?: number;
  error?: string;
  processedAt?: string;
}

export interface ModelAsset {
  name: string;
  originalKey: string;
  optimizedKey?: string | null;
  originalUrl: string;
  optimizedUrl?: string | null;
  sizeMB?: number;
  optimization?: OptimizationInfo;
  metadata?: ModelMetadata;
}

export interface ModelPost {
  price: number;
  previewImage?: string;
  title: string;
  assets: ModelAsset[];
}

// ── Ad Model types ─────────────────────────────────────────────────────────────

export interface AdModelAsset {
  name: string;
  originalKey: string;
  optimizedKey?: string | null;
  originalUrl: string;
  optimizedUrl?: string | null;
  sizeMB?: number;
  optimization?: OptimizationInfo;
  metadata?: ModelMetadata;
}

export interface AdModelPost {
  brandName?: string | null;
  logoUrl?: string | null;
  bgMode: 'color' | 'image';
  bgColor?: string | null;
  bgImageUrl?: string | null;
  bgImagePosition?: string | null;
  bgImageSize?: string | null;
  overlayOpacity: number;
  asset: AdModelAsset;
}

export interface AdModelPostFormProps {
  onCancel: () => void;
  onBack?: () => void;
}

export interface AdAsset {
  id: string;
  file: File;
  previewUrl: string;
  uploadedUrl?: string;
  originalKey?: string;
  name: string;
  progress?: number;
  status?: 'pending' | 'uploading' | 'done' | 'error';
}

// ── Editor prop types ──────────────────────────────────────────────────────────

export interface PocketEditorProps {
  onCancel: () => void;
}

// ── Common fields shared by all post variants ──────────────────────────────────

interface CommonPostFields {
  _id: string;
  user: UserSummary;
  avatarUrl?: string;
  description: string;
  media: string[];
  onOpenDetails?: () => void;
  createdAt: string;
  updatedAt: string;
  disableInteractions?: boolean;
  likes?: number;
  likesCount?: number;
  commentsCount?: number;
  isLiked?: boolean;
  detailed?: boolean;
}

// ── Discriminated union members ────────────────────────────────────────────────

export interface NormalPostProps extends CommonPostFields {
  type: 'normal_post';
  normalPost: { assets: NormalPostAsset[] };
}

export interface GameSystemRequirements {
  ramGB?: number | null;
  cpuCores?: number | null;
  gpuRequired?: boolean;
}

export interface DevlogMeta {
  title?: string;
  thumbnail?: string;
}

export interface GameFile {
  name: string;
  url: string;
  size: number;
}

export interface GamePost {
  gameName: string;
  version: string;
  description: string;
  platform: 'windows';
  buildType: 'windows_exe' | 'windows_zip';
  startPath: string;
  engine?: string;
  runMode: 'sandboxed';
  price: number;
  systemRequirements?: GameSystemRequirements;
  file: GameFile;
}

export interface GamePostProps extends CommonPostFields {
  type: 'game_post';
  gamePost: GamePost;
}

export interface ExePostProps extends CommonPostFields {
  type: 'model_post';
  modelPost?: ModelPost;
}

export interface DevlogPostProps extends CommonPostFields {
  type: 'devlog_post';
  devlogRef: string;
  devlogMeta?: DevlogMeta;
}

export interface AdModelPostProps extends CommonPostFields {
  type: 'ad_model_post';
  adModelPost: AdModelPost;
}

// ── Pocket post ────────────────────────────────────────────────────────────────
// Extends CommonPostFields so it has `type` — required for the discriminated union.
// feed.service.js sets type: "pocket_update" when normalising PocketFeedEntry rows.
// The flat props (brandName, tagline, compiledBundleUrl) are set by the same
// normalisation step so PocketPost.tsx can read them directly.

export interface PocketPostProps extends CommonPostFields {
  type: 'pocket_update';
  brandName:         string;
  tagline?:          string;
  compiledBundleUrl: string;
}

// ── Master union ───────────────────────────────────────────────────────────────

export type PostProps =
  | NormalPostProps
  | GamePostProps
  | ExePostProps
  | DevlogPostProps
  | AdModelPostProps
  | PocketPostProps;