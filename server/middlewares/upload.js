import multer from "multer";
import multerS3 from "multer-s3";
import s3 from "../s3.js";

const bucketName = process.env.AWS_BUCKET_NAME;

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: bucketName,
    contentType: multerS3.AUTO_CONTENT_TYPE, // important for images
    key: function (req, file, cb) {
      cb(null, Date.now().toString() + "-" + file.originalname);
    },
  }),
});

export const uploadGameFiles = upload.fields([
  { name: "gameZip", maxCount: 1 },
  { name: "coverImage", maxCount: 1 },
]);
