import React from "react";

interface VideoPlayerProps {
  url: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ url }) => {
  // Handle empty URL
  if (!url || url.trim() === "") {
    return (
      <div
        style={{
          width: "100%",
          padding: "40px",
          backgroundColor: "#f3f4f6",
          borderRadius: 12,
          textAlign: "center",
          color: "#6b7280",
          border: "2px dashed #d1d5db",
        }}
      >
        <p style={{ margin: 0, fontSize: "14px" }}>
          No video URL provided. Please add a video URL in the settings.
        </p>
      </div>
    );
  }

  return (
    <video
      controls
      style={{
        width: "100%",
        borderRadius: 12,
        backgroundColor: "#000",
      }}
      preload="metadata"
    >
      <source src={url} type="video/mp4" />
      <source src={url} type="video/webm" />
      <source src={url} type="video/ogg" />
      Your browser does not support the video tag.
    </video>
  );
};

export default VideoPlayer;