import React from "react";
import { DropZone } from "@measured/puck";

const FlowchartCanvas: React.FC = () => {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: 600,
        background: "#f5f5f5",
        border: "2px dashed #ccc",
        borderRadius: 12,
      }}
    >
      <DropZone zone="flowzone" />
    </div>
  );
};

export default FlowchartCanvas;
