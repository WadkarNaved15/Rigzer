// import React from "react";
// import type { PageData } from "../../types/Devlogs";
// import GameLogo from "./GameLogo";
// import Purchase from "./Purchase";
// import SideBar from "./SideBar";
// import GameInfo from "./GameInfo";
// import DraggableScreenshot from "./DraggableImage";
// import DraggableVideo from "./DraggableVideo";
// import DraggableFile from "./DraggableFile";
// import DraggableBlog from "./DraggableBlog";

// interface DevLogViewProps {
//   pageData: PageData;
//   leftColumnCards: string[];
//   rightColumnCards: string[];
//   gradientColor: string;
// }

// /**
//  * Pure read-only renderer for a saved devlog.
//  * No drag, upload, or edit logic.
//  */
// const DevLogView: React.FC<DevLogViewProps> = ({
//   pageData,
//   leftColumnCards,
//   rightColumnCards,
//   gradientColor,
// }) => {
//   const renderCard = (card: string) => {
//     // Check if it's a screenshot
//     const screenshot = pageData.screenshots.find((s) => s.id === card);
//     if (screenshot) {
//       return (
//         <DraggableScreenshot
//           key={card}
//           id={card}
//           media={screenshot}
//           onRemove={() => {}}
//           readOnly
//         />
//       );
//     }

//     // Check if it's a video
//     const video = pageData.videos.find((v) => v.id === card);
//     if (video) {
//       return (
//         <DraggableVideo
//           key={card}
//           id={card}
//           media={video}
//           onRemove={() => {}}
//           readOnly
//         />
//       );
//     }

//     // Check if it's a file
//     const file = pageData.files.find((f) => f.id === card);
//     if (file) {
//       return (
//         <DraggableFile
//           key={card}
//           id={card}
//           fileItem={file}
//           onRemove={() => {}}
//           readOnly
//         />
//       );
//     }

//     // Check if it's a blog section
//     const blogSection = pageData.blogSections.find((b) => b.id === card);
//     if (blogSection) {
//       return (
//         <DraggableBlog
//           key={card}
//           id={card}
//           blogSection={blogSection}
//           onUpdate={() => {}}
//           onRemove={() => {}}
//           readOnly
//         />
//       );
//     }

//     // Render static components
//     switch (card) {
//       case "GameLogo":
//         return <GameLogo key={card} id={card} pageData={pageData} readOnly />;
//       case "Purchase":
//         return <Purchase key={card} id={card} pageData={pageData} readOnly />;
//       case "GameInfo":
//         return <GameInfo key={card} id={card} pageData={pageData} readOnly />;
//       case "SideBar":
//         return <SideBar key={card} id={card} pageData={pageData} readOnly />;
//       default:
//         return null;
//     }
//   };

//   return (
//     <div className="relative min-h-screen">
//       {/* Background */}
//       <div
//         className="fixed inset-0 -z-10 bg-cover bg-center bg-slate-800"
//         style={{
//           backgroundImage: pageData.bgImage
//             ? `linear-gradient(to right, rgba(${gradientColor},1) 0%, rgba(${gradientColor},0.8) 30%, rgba(${gradientColor},0) 70%), url(${pageData.bgImage.url})`
//             : `linear-gradient(to right, rgba(${gradientColor},1) 0%, rgba(${gradientColor},0.8) 30%, rgba(${gradientColor},0) 70%)`,
//         }}
//       />

//       <main className="relative z-10 min-h-screen p-4 text-[#ffb347] font-mono">
//         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
//           {/* LEFT */}
//           <div className="lg:col-span-2 space-y-6">
//             {leftColumnCards.map(renderCard)}
//           </div>

//           {/* RIGHT */}
//           <div className="lg:col-span-1 space-y-6">
//             {rightColumnCards.map(renderCard)}
//           </div>
//         </div>
//       </main>
//     </div>
//   );
// };

// export default DevLogView;
