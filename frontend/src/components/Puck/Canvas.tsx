import React, { useState, useEffect } from "react";
import type { ComponentConfig } from "@measured/puck";
import "@excalidraw/excalidraw/index.css";


interface ExcalidrawComponentProps {
  initialData?: any;
  viewModeEnabled?: boolean; 
  zenModeEnabled?: boolean;
  gridModeEnabled?: boolean;
  theme?: "light" | "dark";
  name?: string;
}

export const ExcalidrawComponent: React.FC<ExcalidrawComponentProps> = ({
  initialData,
  viewModeEnabled = false,
  zenModeEnabled = false,
  gridModeEnabled = true,
  theme = "light",
  name = "Excalidraw Drawing",
}) => {
  const [Excalidraw, setExcalidraw] = useState<any>(null);
 const [sceneData, setSceneData] = useState(initialData);



  useEffect(() => {
    let cancelled = false;

    import("@excalidraw/excalidraw")
      .then((mod) => {
        if (!cancelled) setExcalidraw(() => mod.Excalidraw);
      })
      .catch((err) => console.error("Failed to load Excalidraw:", err));

    return () => {
      cancelled = true;
    };
  }, []);

 const firstRender = React.useRef(true);

const handleChange = (elements: any, appState: any) => {
  if (firstRender.current) {
    firstRender.current = false;
    return; // skip initial mount change
  }
  setSceneData({ elements, appState });
};



  if (!Excalidraw) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading drawing tools...</p>
        </div>
      </div>
    );
  }

const UIOptions = {
  canvasActions: {
    changeViewBackgroundColor: true,
    clearCanvas: true,
    loadScene: true,
    export: {
      saveFileToDisk: true,
      exportToBackend: undefined, // Optional: define if needed
      renderCustomUI: undefined,  // Optional: define if needed
    },
    saveToActiveFile: true,
    toggleTheme: true,
    saveAsImage: true,
  },
};

  return (
    <div
      style={{
        height: "600px",
        width: "100%",
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
      }}
    >
      <Excalidraw
  initialData={initialData}  // ✅ pass the prop only
  onChange={handleChange}    // store latest scene if needed
  viewModeEnabled={viewModeEnabled}
  zenModeEnabled={zenModeEnabled}
  gridModeEnabled={gridModeEnabled}
  theme={theme}
  name={name}
  UIOptions={UIOptions}
/>


    </div>
  );
};

// ✅ Puck Config
export const ExcalidrawConfig: ComponentConfig<ExcalidrawComponentProps> = {
  fields: {
    viewModeEnabled: {
      type: "radio",
      label: "View Mode",
      options: [
        { label: "Edit Mode", value: false },
        { label: "View Only", value: true },
      ],
    },
    zenModeEnabled: {
      type: "radio",
      label: "Zen Mode",
      options: [
        { label: "Off", value: false },
        { label: "On", value: true },
      ],
    },
    gridModeEnabled: {
      type: "radio",
      label: "Grid",
      options: [
        { label: "Show Grid", value: true },
        { label: "Hide Grid", value: false },
      ],
    },
    theme: {
      type: "radio",
      label: "Theme",
      options: [
        { label: "Light", value: "light" },
        { label: "Dark", value: "dark" },
      ],
    },
    name: {
      type: "text",
      label: "Drawing Name",
    },
  },
  defaultProps: {
    viewModeEnabled: false,
    zenModeEnabled: false,
    gridModeEnabled: true,
    theme: "light",
    name: "Excalidraw Drawing",
  },
  render: (props) => <ExcalidrawComponent {...props} />,
};
