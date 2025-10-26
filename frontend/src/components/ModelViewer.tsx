import "@google/model-viewer";

export default function ModelViewer() {
  return (
    <div style={{ width: "100%", height: "100vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
      <model-viewer
        src="/models/full_gameready_city_buildings.glb"
        alt="3D model"
        auto-rotate
        camera-controls
        style={{ width: "600px", height: "400px" }}
      ></model-viewer>
    </div>
  );
}
