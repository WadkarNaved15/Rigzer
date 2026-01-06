import mongoose from "mongoose";
import Canvas from "../models/Canvas.js";

/**
 * GET /api/canvas/:id
 * Public endpoint to fetch published canvas
 */
export const getPublishedCanvasById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId early
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid canvas ID" });
    }

    const canvas = await Canvas.findOne({
      _id: id,
      status: "published",
    }).lean();

    if (!canvas) {
      return res.status(404).json({
        message: "Canvas not found or not published",
      });
    }

    return res.status(200).json(canvas);
  } catch (error) {
    console.error("Error fetching canvas:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};
// controllers/canvas.controller.js
export const getPublishedCanvases = async (req, res) => {
  try {
    const canvases = await Canvas.find(
      { status: "published" },
      {
        title: 1,
        hero_image_url: 1,
        author_name: 1,
        publishedAt: 1,
      }
    )
      .sort({ publishedAt: -1 })
      .lean();

    res.status(200).json(canvases);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch canvases" });
  }
};

