import React from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";


function ExcaliDraw() {
   const UIOptions = {
    canvasActions: {
      changeViewBackgroundColor: true,
      clearCanvas: false,
      loadScene: false,
    },
  };
  return (
    <>
      <h1 style={{ textAlign: "center" }}>Excalidraw Example</h1>
      <div style={{ margin: "auto", height: "90vh", width: "90vw" }}>
        <Excalidraw UIOptions={UIOptions} />
      </div>
    </>
  );
}

export default ExcaliDraw;
