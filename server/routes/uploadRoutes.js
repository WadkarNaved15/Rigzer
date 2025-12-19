// import express from "express";
// import multer from "multer";
// import fs from "fs";
// import path from "path";
// import unzipper from "unzipper";
// import { v4 as uuidv4 } from "uuid";
// import Post from "../models/Post.js";
// import verifyToken from "../middlewares/authMiddleware.js";

// const router = express.Router();

// const tempDir = path.resolve("temp");
// const uploadsDir = path.resolve("uploads");

// if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
// if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// // Multer setup
// const storage = multer.diskStorage({
//   destination: tempDir,
//   filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
// });
// const upload = multer({ storage });

// // Helper: Recursively find a file by extension
// function findFileByExtension(dir, ext) {
//   const files = fs.readdirSync(dir);
//   for (const file of files) {
//     const fullPath = path.join(dir, file);
//     const stat = fs.statSync(fullPath);
//     if (stat.isDirectory()) {
//       const result = findFileByExtension(fullPath, ext);
//       if (result) return result;
//     } else if (file.toLowerCase().endsWith(ext)) {
//       return fullPath;
//     }
//   }
//   return null;
// }

// router.post("/", verifyToken, upload.single("gamezip"), async (req, res) => {
//   const file = req.file;
//   const userId = req.user.id;
//   const { description } = req.body;

//   if (!file) return res.status(400).send("No file uploaded");
//   if (!description) return res.status(400).send("Description is required");

//   const uniqueFolder = uuidv4();
//   const extractPath = path.join(uploadsDir, uniqueFolder);
//   fs.mkdirSync(extractPath);

//   fs.createReadStream(file.path)
//   .pipe(unzipper.Extract({ path: extractPath }))
//   .on("finish", async () => {
//     setTimeout(() => {
//       fs.unlink(file.path, (unlinkErr) => {
//         if (unlinkErr) {
//           console.error(`User ID: ${userId}`);
//           console.error("Failed to delete temp zip:", unlinkErr);
//         } else {
//           console.log("Temp zip deleted successfully.");
//         }
//       });
//     }, 1000); // Delay 1 second

//       try {
//         // Find index.html or .exe
//         const indexHtmlPath = findFileByExtension(extractPath, "index.html");
//         const exePath = findFileByExtension(extractPath, ".exe");

//         let gameType = "";
//         let gameUrl = "";

//         if (indexHtmlPath) {
//           // Web game
//           gameType = "game_post";
//           const relativePath = indexHtmlPath.split("uploads")[1].replace(/\\/g, "/");
//           gameUrl = `${req.protocol}://${req.get("host")}/uploads${relativePath}`;
//         } else if (exePath) {
//           // EXE game
//           gameType = "exe_post";
//           gameUrl = exePath; // Local path, for now. You may want to restrict or hide this from client later.
//         } else {
//           return res.status(400).send("No valid game file found (.exe or index.html)");
//         }

//         const newPost = new Post({
//           user: userId,
//           description,
//           type: gameType,
//           gameUrl,
//           media: [],
//         });

//         await newPost.save();

//         res.status(201).json({
//           message: "Game uploaded successfully",
//           post: newPost,
//         });

//       } catch (err) {
//         console.error("Game detection error:", err);
//         res.status(500).send("Error while preparing game");
//       }
//     })
//     .on("error", (err) => {
//       console.error("Unzip error:", err);
//       res.status(500).send("Failed to extract ZIP file");
//     });
// });

// export default router;
import express from "express";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import s3 from "../s3.js";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();

router.post("/presigned-url", async (req, res) => {
  try {
    console.log("Presigned URL request received");
    const { fileName, fileType } = req.body;

    if (!fileName) {
      return res.status(400).json({ message: "File name required" });
    }

    const key = `models/raw/${uuidv4()}-${fileName}`;

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      ContentType: fileType || "model/gltf-binary",
    });

    const uploadUrl = await getSignedUrl(s3, command, {
      expiresIn: 300, // 5 minute
    });

    res.json({
      uploadUrl,
      key,
      // CloudFront URL used later for viewing
      fileUrl: `${process.env.CLOUDFRONT_DOMAIN}/${key}`,
    });

  } catch (err) {
    console.error("Presigned URL error:", err);
    res.status(500).json({ message: "Failed to generate upload URL" });
  }
});

export default router;
