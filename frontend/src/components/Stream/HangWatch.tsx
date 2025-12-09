// import React, { useEffect, useRef, useCallback } from "react";
// import WatchElement from "@kixelated/hang/watch/element";
// import { VideoRenderer } from "@kixelated/hang/watch";

// const HANG_URL = "https://relay.xn--tlay-0ra.com:4453/anon";

// const HangWatch: React.FC = () => {
//   const containerRef = useRef<HTMLDivElement>(null);
//   const canvasRef = useRef<HTMLCanvasElement | null>(null);
//   const videoRendererRef = useRef<VideoRenderer | null>(null);

//   const resizeCanvas = useCallback(() => {
//     if (!canvasRef.current) return;
//     canvasRef.current.width = window.innerWidth;
//     canvasRef.current.height = window.innerHeight;
//   }, []);

//   useEffect(() => {
//     const container = containerRef.current;
//     if (!container) return;

//     const el = new WatchElement();
//     el.connection.url.set(new URL(HANG_URL));
//     el.setAttribute("name", "bbb");
//     el.controls = true;
//     el.volume = 1.0;

//     const canvas = document.createElement("canvas");
//     canvas.id = "game-canvas";
//     canvas.style.display = "block";
//     canvas.style.width = "100vw";
//     canvas.style.height = "100vh";

//     canvasRef.current = canvas;
//     resizeCanvas();

//     const videoRenderer = new VideoRenderer(el.video.source, { canvas });
//     videoRendererRef.current = videoRenderer;

//     el.prepend(canvas);
//     container.appendChild(el);

//     window.addEventListener("resize", resizeCanvas);

//     return () => {
//       window.removeEventListener("resize", resizeCanvas);
//       videoRendererRef.current?.close();
//       videoRendererRef.current = null;

//       if (container.contains(el)) {
//         container.removeChild(el);
//       }
//     };
//   }, [resizeCanvas]);

//   return (
//     <div
//       ref={containerRef}
//       style={{
//         width: "100%",
//         height: "100%",
//         margin: 0,
//         padding: 0,
//         overflow: "hidden",
//       }}
//     />
//   );
// };

// export default HangWatch;
