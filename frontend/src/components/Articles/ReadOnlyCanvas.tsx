import React from "react";
import { BackgroundSection } from "./BackgroundManager";

interface ReadOnlyCanvasProps {
  data: any; // published canvas document from backend
}

export default function ReadOnlyCanvas({ data }: ReadOnlyCanvasProps) {
  const canvasWidth = Math.min(window.innerWidth - 64, 900);

  const maxSectionEnd =
    data.background_sections?.length > 0
      ? Math.max(...data.background_sections.map((s: any) => s.endPosition))
      : 2000;

  const canvasHeight = Math.max(maxSectionEnd + 500, 2000);

  /* 🔹 SAME background rendering logic (copied from PublisherForm) */
  const renderBackgroundSections = () => {
    return data.background_sections.map((section: BackgroundSection) => {
      const height = section.endPosition - section.startPosition;

      return (
        <div
          key={section.id}
          className="absolute w-full z-0"
          style={{
            top: `${section.startPosition}px`,
            height: `${height}px`,
            background:
              section.type === "color"
                ? section.value
                : `url(${section.value}) center / cover no-repeat`,
          }}
        />
      );
    });
  };

  /* 🔹 Render blocks WITHOUT inputs */
  const renderBlock = (block: any) => {
    const style: React.CSSProperties = {
      position: "absolute",
      left: block.position.x,
      top: block.position.y,
      color: block.colors?.text,
      background: block.colors?.background,
      zIndex: block.zIndex ?? 1,
    };

    switch (block.type) {
      case "heading":
        return (
          <h1 style={style} className="text-3xl font-semibold">
            {block.content}
          </h1>
        );

      case "paragraph":
        return (
          <p style={style} className="text-base leading-relaxed max-w-[800px]">
            {block.content}
          </p>
        );

      case "blockquote":
        return (
          <blockquote
            style={{
              ...style,
              borderLeft: `4px solid ${data.theme_colors.accent}`,
              paddingLeft: 16,
            }}
            className="italic text-sm"
          >
            {block.content}
          </blockquote>
        );

      case "image":
        return (
          <img
            src={block.content}
            alt={block.metadata?.alt || ""}
            style={{
              ...style,
              width: block.size?.width,
              height: block.size?.height,
              objectFit: "cover",
              borderRadius: 8,
            }}
            draggable={false}
          />
        );

      case "video":
        return (
          <video
            src={block.content}
            style={{
              ...style,
              width: block.size?.width,
              height: block.size?.height,
              objectFit: "cover",
            }}
            controls
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="w-full flex justify-center bg-[#0A0A0A] py-16">
      <div
        className="relative overflow-hidden"
        style={{
          width: canvasWidth,
          minHeight: canvasHeight,
          background: data.theme_colors.background,
        }}
      >
        {renderBackgroundSections()}

        <main className="relative z-10 p-20">
          {data.content.map((block: any) => (
            <React.Fragment key={block.id}>
              {renderBlock(block)}
            </React.Fragment>
          ))}
        </main>
      </div>
    </div>
  );
}
