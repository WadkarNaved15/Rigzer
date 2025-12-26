import mongoose from "mongoose";

const CanvasObjectSchema = new mongoose.Schema({
  id: { type: String, required: true },

  type: {
    type: String,
    enum: ['image', 'video', 'text', 'file', 'spritesheet'],
    required: true
  },

  x: Number,
  y: Number,
  scaleX: Number,
  scaleY: Number,
  rotation: Number,

  // Image / Video
  source: String,

  // Text
  text: String,
  textStyle: {
    fontFamily: String,
    fontSize: Number,
    fill: mongoose.Schema.Types.Mixed,
    fontWeight: { type: String, enum: ['normal', 'bold'] },
    fontStyle: { type: String, enum: ['normal', 'italic'] },
    align: { type: String, enum: ['left', 'center', 'right'] },
    letterSpacing: Number,
    lineHeight: Number
  },

  // File
  file: {
    name: String,
    url: String,
    size: Number,
    mimeType: String
  },

  // Spritesheet
  spritesheet: {
    jsonUrl: String,
    imageUrl: String,
    animationName: String,
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