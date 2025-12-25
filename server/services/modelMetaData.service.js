import fs from "fs";
import path from "path";
import os from "os";
import https from "https";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/* ---------------- FIX FOR NODE ---------------- */
globalThis.self = globalThis;
THREE.ImageBitmapLoader.prototype.load = function () { return null; };
/* --------------------------------------------- */

// Download file to a temporary path
const downloadFile = (url, outputPath) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`Download failed with status ${res.statusCode}`));
      }
      res.pipe(file);
      file.on("finish", () => file.close(resolve));
    }).on("error", (err) => {
      fs.unlink(outputPath, () => {}); // clean up partial file
      reject(err);
    });
  });
};

export const extractMetadataFromUrl = async (fileUrl) => {
  // ✅ Use OS temporary directory (cross-platform)
  const tempDir = os.tmpdir();
  const tempPath = path.join(tempDir, `${Date.now()}.glb`);

  try {
    await downloadFile(fileUrl, tempPath);

    const loader = new GLTFLoader();
    const buffer = fs.readFileSync(tempPath);

    const gltf = await new Promise((resolve, reject) => {
      loader.parse(buffer.buffer, "", resolve, reject);
    });

    const scene = gltf.scene;

    // Initialize counters
    let meshCount = 0;
    let vertexCount = 0;
    let triangleCount = 0;
    let materialCount = 0;
    let uvLayers = 0;
    let hasVertexColors = false;
    let hasPBR = false;
    let hasSkins = false;
    let hasMorphTargets = false;

    scene.traverse((obj) => {
      if (obj.isMesh) {
        meshCount++;

        const geometry = obj.geometry;

        if (geometry.attributes.uv) uvLayers = Math.max(uvLayers, 1);
        if (geometry.attributes.uv2) uvLayers = Math.max(uvLayers, 2);

        if (geometry.attributes.color) hasVertexColors = true;

        if (geometry.morphAttributes && Object.keys(geometry.morphAttributes).length > 0) {
          hasMorphTargets = true;
        }

        if (obj.isSkinnedMesh) hasSkins = true;

        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        materials.forEach((mat) => {
          if (mat?.isMeshStandardMaterial || mat?.isMeshPhysicalMaterial) {
            hasPBR = true;
          }
        });

        const pos = geometry.attributes.position;
        if (pos) {
          vertexCount += pos.count;
          triangleCount += pos.count / 3;
        }

        materialCount += materials.length;
      }
    });

    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);

    const center = new THREE.Vector3();
    box.getCenter(center);

    return {
      fileName: path.basename(fileUrl),
      fileSizeMB: (fs.statSync(tempPath).size / 1024 / 1024).toFixed(2),

      geometry: {
        meshes: meshCount,
        vertices: vertexCount,
        triangles: Math.floor(triangleCount),
      },

      materials: {
        count: materialCount,
        usesPBR: hasPBR,
      },

      textures: {
        present: materialCount > 0,
      },

      uvLayers,
      vertexColors: hasVertexColors,

      animations: {
        present: gltf.animations.length > 0,
        count: gltf.animations.length,
      },

      rigged: hasSkins,
      morphTargets: hasMorphTargets,

      transforms: {
        scale: scene.scale.toArray(),
        position: scene.position.toArray(),
        rotation: scene.rotation.toArray(),
      },

      boundingBox: {
        width: size.x.toFixed(3),
        height: size.y.toFixed(3),
        depth: size.z.toFixed(3),
      },

      center: {
        x: center.x.toFixed(3),
        y: center.y.toFixed(3),
        z: center.z.toFixed(3),
      },
    };
  } finally {
    // ✅ Cleanup temporary file
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  }
};
