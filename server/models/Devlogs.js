import mongoose from "mongoose";

const MediaSchema = new mongoose.Schema({
  url: { type: String, required: true },
  type: { type: String },
});

const FileItemSchema = new mongoose.Schema({
  id: { type: Number },
  title: { type: String },
  size: { type: String },
  url: { type: String }, // store S3 URL instead of raw File object
});

const GameDetailsSchema = new mongoose.Schema({
  status: String,
  author: String,
  genre: String,
  tags: String,
});

const DevlogSchema = new mongoose.Schema(
  {
    pageData: {
      gameTitle: String,
      postTitle: String,
      postTag: String,
      postDate: String,
      author: String,
      italicQuote: String,
      bodyParagraph1: String,
      bodyParagraph2: String,
      bodyParagraph3: String,
      storeLink: String,
      closingQuote: String,
      signature: String,
      files: [FileItemSchema],
      price: String,
      gameInfoTitle: String,
      gameInfoDescription: String,
      gameDetails: GameDetailsSchema,
      screenshots: [MediaSchema],
      videos: [MediaSchema],
      bgImage: MediaSchema,
      gameTitleImage: MediaSchema,
    },
    leftColumnCards: [String],
    rightColumnCards: [String],
    gradientColor: String,
  },
  { timestamps: true }
);

export default mongoose.model("Devlog", DevlogSchema);
