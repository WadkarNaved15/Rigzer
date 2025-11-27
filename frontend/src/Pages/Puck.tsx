import React, { useState } from "react";
import { Puck, Render } from "@measured/puck";
import { config } from "../components/Puck/puckConfig";
import "@measured/puck/puck.css";

const PuckEditor = () => {
   const [mode, setMode] = useState<"edit" | "view">("edit");
  const [data, setData] = useState<any>({
    // Set initial content for Puck
    content: [
      {
        type: "Excalidraw",
        props: {
          id: "excalidraw-1", // Puck requires a unique id
          // You can pre-populate the drawing here if you want
          // initialData: { elements: [ ... ], appState: { ... } }
        },
      },
    ],
    root: {},
  });

  return (
    <div style={{ fontFamily: "sans-serif" }}>
      <div
        style={{
          display: "flex",
          gap: 16,
          padding: "16px",
          borderBottom: "1px solid #eee",
          background: "#f9f9f9",
        }}
      >
        <button
          onClick={() => setMode("edit")}
          style={{
            padding: "8px 16px",
            fontSize: "14px",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            background: mode === "edit" ? "#007aff" : "#eee",
            color: mode === "edit" ? "white" : "black",
          }}
        >
          Editor
        </button>
        <button
          onClick={() => setMode("view")}
          style={{
            padding: "8px 16px",
            fontSize: "14px",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            background: mode === "view" ? "#007aff" : "#eee",
            color: mode === "view" ? "white" : "black",
          }}
        >
          Preview
        </button>
      </div>

      {mode === "edit" ? (
        <Puck
          config={config}
          data={data}
          onPublish={(newData) => {
            setData(newData);
            setMode("view");
          }}
        />
      ) : (
        // The <Render> component renders the "view" mode
        // It does NOT pass an `onChange` prop to components
        <div style={{ padding: "32px" }}>
          <Render config={config} data={data} />
        </div>
      )}
    </div>
  );
};

export default PuckEditor;
