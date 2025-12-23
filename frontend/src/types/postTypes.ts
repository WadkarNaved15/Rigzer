export type PostType = "model" | "media" | "game";
export const POST_TYPES: { id: PostType; label: string }[] = [
  { id: "model", label: "3D Model" },
  { id: "media", label: "Media" },
  { id: "game", label: "Game" },
];