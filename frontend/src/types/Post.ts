// types/post.ts

export type PostType = 'normal_post' | 'game_post' | 'model_post';

export interface UserSummary {
  _id: string;
  username: string;
  email: string;
  avatarUrl?: string;
}
export interface ModelMetadata {
  fileName: string;
  downloadSizeMB: number;

  geometry: {
    meshes: number;
    vertices: number;
    triangles: number;
  };

  materials: number;

  textures: {
    present: boolean;
    count: number;
  };

  uvLayers: number;
  vertexColors: boolean;

  animations: {
    present: boolean;
    count: number;
  };

  rigged: boolean;
  morphTargets: boolean;

  transforms: {
    scale: [number, number, number];
    position: [number, number, number];
    rotation: {
      values: [number, number, number];
      order: "XYZ" | "XZY" | "YXZ" | "YZX" | "ZXY" | "ZYX";
    };
  };

  boundingBox: {
    width: number;
    height: number;
    depth: number;
  };

  center: {
    x: number;
    y: number;
    z: number;
  };
}
export interface NormalPostAsset {
  name: string;
  url: string;
  type: "image" | "video";
}

export interface ModelAsset {
  name: string;
  url: string;
  sizeMB?: number;
  metadata: ModelMetadata;
}

export interface ModelPost {
  price: number;
  previewImage?: string;
  title: string;
  assets: ModelAsset[];
}
// Base structure
interface CommonPostFields {
  _id: string;
  type: PostType;
  user: UserSummary;
  avatarUrl?: string;
  description: string;
  media: string[];
  onOpenDetails?: () => void;
  createdAt: string;
  updatedAt: string;
  disableInteractions?: boolean;
  likes?: number;
  detailed?: boolean;
  comments?: number;
}

// Specific post types
export interface NormalPostProps extends CommonPostFields {
  type: 'normal_post';
  normalPost: {
    assets: NormalPostAsset[];
  };
}

export interface GamePostProps extends CommonPostFields {
  type: 'game_post';
  gameUrl: string;
}

export interface ExePostProps extends CommonPostFields {
  type: 'model_post';
  // gameUrl: string;
  modelPost?: ModelPost;
}

export type PostProps = NormalPostProps | GamePostProps | ExePostProps;
