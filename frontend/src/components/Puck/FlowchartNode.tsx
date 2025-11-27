import React from "react";

interface Props {
  title: string;
  x: number;
  y: number;
  color: string;
}

const FlowchartNode: React.FC<Props> = ({ title, x, y, color }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      background: color,
      color: "#fff",
      padding: 12,
      borderRadius: 8,
      cursor: "move",
      userSelect: "none",
    }}
  >
    {title}
  </div>
);

export default FlowchartNode;
