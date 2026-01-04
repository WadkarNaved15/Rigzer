// models/Canvas.js
import mongoose from "mongoose";

const { Schema } = mongoose;

// Sub-schema for theme colors
const ThemeColorsSchema = new Schema(
  {
    background: { type: String, default: "#ffffff" },
    text: { type: String, default: "#000000" },
    primary: { type: String },
    secondary: { type: String },
    accent: { type: String },
  },
  { _id: false }
);

// Sub-schema for background sections
const BackgroundSectionSchema = new Schema(
  {
    id: { type: String, required: true },
    type: { type: String, enum: ["color", "image"], required: true },
    value: { type: String, required: true },
    startPosition: { type: Number, default: 0 },
    endPosition: { type: Number, default: 100 },
  },
  { _id: false }
);

// Content schema
const ContentSchema = new Schema(
  {
    id: { type: String, required: true },

    type: {
      type: String,
      enum: [
        "paragraph",
        "heading",
        "image",
        "video",
        "blockquote",
        "title",
        "subtitle",
      ],
      required: true,
    },

    content: { type: String, required: true },

    metadata: {
      alt: String,
      duration: String,
    },

    position: {
      x: { type: Number, required: true },
      y: { type: Number, required: true },
    },

    size: {
      width: Number,
      height: Number,
    },

    colors: {
      text: String,
      background: String,
    },

    zIndex: { type: Number, default: 0 },

    alignment: {
      horizontal: { type: String, enum: ["left", "center", "right"] },
      vertical: { type: String, enum: ["top", "middle", "bottom"] },
      snapTo: { type: String, enum: ["canvas", "element"] },
      referenceId: String,
    },
  },
  { _id: false }
);

// Main Canvas schema
const CanvasSchema = new Schema(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    title: { type: String, required: true, trim: true },
    subtitle: { type: String, trim: true },
    hero_image_url: String,
    category: String,

    publisher_name: String,
    genre: String,
    rating: String,
    author_name: String,
    author_role: String,

    theme_colors: ThemeColorsSchema,
    background_sections: [BackgroundSectionSchema],
    content: [ContentSchema],

    profiles: [
      {
        name: String,
        role: String,
      },
    ],

    links: [
      {
        title: String,
        url: String,
        type: String,
      },
    ],

    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },
    publishedAt: Date,
  },
  { timestamps: true }
);

// Index
CanvasSchema.index({ ownerId: 1, status: 1 });

const Canvas = mongoose.model("Canvas", CanvasSchema);
export default Canvas;
