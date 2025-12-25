import mongoose from "mongoose";

const CanvasObjectSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: {
    type: String,
    enum: ['image', 'video', 'text', 'file', 'code', 'spritesheet', 'lottie'],
    required: true
  },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  scaleX: { type: Number, required: true },
  scaleY: { type: Number, required: true },
  rotation: { type: Number, required: true },
  
  // For images and videos
  source: { type: String }, // S3 key or URL
  
  // For text
  text: { type: String },
  textStyle: {
    fontFamily: String,
    fontSize: Number,
    fill: mongoose.Schema.Types.Mixed, // Can be number or string
    fontWeight: { type: String, enum: ['normal', 'bold'] },
    fontStyle: { type: String, enum: ['normal', 'italic'] },
    align: { type: String, enum: ['left', 'center', 'right'] },
    letterSpacing: Number,
    lineHeight: Number
  },
  
  // For files
  filename: { type: String },
  
  // For code objects
  code: { type: String },
  
  // For spritesheets
  spritesheet: {
    jsonUrl: String, // S3 key
    imageUrl: String, // S3 key
    animationName: String,
    autoplay: Boolean,
    loop: Boolean
  },
  
  // For Lottie animations
  lottie: {
    jsonUrl: String, // S3 key
    autoplay: Boolean,
    loop: Boolean
  }
}, { _id: false });

const CanvasSceneSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    default: 'Untitled Canvas'
  },
  description: {
    type: String,
    default: ''
  },
  objects: [CanvasObjectSchema],
  cameraX: {
    type: Number,
    default: 0
  },
  cameraY: {
    type: Number,
    default: 0
  },
  cameraZoom: {
    type: Number,
    default: 1
  },
  thumbnail: {
    type: String // S3 key for preview image
  },
  isComplete: {
  type: Boolean,
  default: false
},
  isPublic: {
    type: Boolean,
    default: false
  },
  tags: [String]
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Index for searching
CanvasSceneSchema.index({ title: 'text', description: 'text', tags: 'text' });

const CanvasScene = mongoose.model("CanvasScene", CanvasSceneSchema);

export default CanvasScene;