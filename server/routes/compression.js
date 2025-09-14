import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import gltfPipeline from "gltf-pipeline";

const { processGltf, glbToGltf, gltfToGlb } = gltfPipeline;

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/", upload.single("model"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const filePath = req.file.path;
    const originalName = req.file.originalname;
    const ext = path.extname(originalName).toLowerCase();

    const outputPath = path.join("uploads", `${Date.now()}.glb`);

    if (ext === ".glb" || ext === ".gltf") {
      const fileData = fs.readFileSync(filePath);

      let gltf;

      if (ext === ".gltf") {
        // Parse .gltf JSON
        gltf = JSON.parse(fileData.toString("utf8"));
      } else {
        // Convert GLB → glTF JSON
        const { gltf: converted } = await glbToGltf(fileData);
        gltf = converted;
      }

      // ✅ Compress with Draco + embed textures
      const options = {
        dracoOptions: undefined,
        separateTextures: false, // ✅ ensures all textures are embedded inside .glb
        separate: false,         // ✅ keep everything bundled
        // keepUnusedElements: true,   // ✅ keep extension data
        // keepAttributes: true        // ✅ prevent dropping attributes used in extensions
      };

      const results = await processGltf(gltf, options);

      // Convert compressed glTF JSON → GLB
      const compressedGlb = await gltfToGlb(results.gltf);

      fs.writeFileSync(outputPath, compressedGlb.glb);
      
      const beforeSize = fs.statSync(filePath).size / 1024 / 1024; // MB
      const afterSize = fs.statSync(outputPath).size / 1024 / 1024; // MB
      
      fs.unlinkSync(filePath);
      return res.json({
        success: true,
        message: "Model uploaded & compressed successfully",
        path: outputPath,
        sizeBeforeMB: beforeSize.toFixed(2),
        sizeAfterMB: afterSize.toFixed(2),
      });
    } else {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        success: false,
        message: "Please upload a .glb or .gltf file.",
      });
    }
  } catch (err) {
    console.error("Error uploading/compressing model:", err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

export default router;
