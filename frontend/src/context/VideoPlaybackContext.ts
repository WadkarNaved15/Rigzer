import { createContext} from "react";
export const VideoPlaybackContext = createContext<{
  activeVideo: HTMLVideoElement | null;
  setActiveVideo: (v: HTMLVideoElement | null) => void;
}>({ activeVideo: null, setActiveVideo: () => {} });
