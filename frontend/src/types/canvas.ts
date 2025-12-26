/* ---------------------------------- */
/* Shared Canvas Types (SINGLE SOURCE) */
/* ---------------------------------- */

export type CanvasObjectType =
  | 'image'
  | 'video'
  | 'text'
  | 'file'
  | 'spritesheet'

export interface TextStyleState {
  fontFamily?: string
  fontSize?: number
  fill?: number | string
  fontWeight?: 'normal' | 'bold'
  fontStyle?: 'normal' | 'italic'
  align?: 'left' | 'center' | 'right'
  letterSpacing?: number
  lineHeight?: number
}

export interface SpriteSheetState {
  jsonUrl: string
  imageUrl: string
  animationName?: string
  autoplay?: boolean
  loop?: boolean
}

/**
 * ✅ SINGLE SOURCE OF TRUTH
 * Used by editor, uploader, API payloads
 */
export interface CanvasObject {
  /* identity */
  id: string
  type: CanvasObjectType

  /* transforms (EDITOR CORE) */
  x: number
  y: number
  scaleX: number
  scaleY: number
  rotation: number

  /* image / video */
  source?: string // blob URL OR S3 key

  /* text */
  text?: string
  textStyle?: TextStyleState

  /* file */
  file?: {
    name: string
    url: string // blob OR S3 key
    size?: number
    mimeType?: string
  }

  /* spritesheet */
  spritesheet?: SpriteSheetState
}

/* ---------------------------------- */
/* Scene */
/* ---------------------------------- */

export interface SceneState {
  objects: CanvasObject[]
  cameraX: number
  cameraY: number
  cameraZoom: number
}
