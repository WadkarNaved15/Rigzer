import AllPost from "../models/Allposts.js";

export const playGame = async (req, res) => {
  try {
    const { postId } = req.params;

    const post = await AllPost.findOne({
      _id: postId,
      type: "game_post",
    });

    if (!post) {
      return res.status(404).json({ message: "Game not found" });
    }

    // If already failed, block play
    if (post.gamePost.verification.status === "failed") {
      return res.status(400).json({
        message: "Game failed verification",
        error: post.gamePost.verification.error,
      });
    }

    // ---- VM STEP (pseudo for now) ----
    // 1. Download ZIP
    // 2. Extract safely
    // 3. Check startPath exists

    const startPath = post.gamePost.startPath;

    const startFileExists = false; // <-- replace with real VM check

    if (!startFileExists) {
      await AllPost.updateOne(
        { _id: postId },
        {
          $set: {
            "gamePost.verification.status": "failed",
            "gamePost.verification.error": `Start file not found: ${startPath}`,
            "gamePost.verification.verifiedAt": new Date(),
          },
        }
      );

      return res.status(400).json({
        message: "Game verification failed",
        error: `Start file not found: ${startPath}`,
      });
    }

    // ---- SUCCESS ----
    await AllPost.updateOne(
      { _id: postId },
      {
        $set: {
          "gamePost.verification.status": "verified",
          "gamePost.verification.error": null,
          "gamePost.verification.verifiedAt": new Date(),
        },
      }
    );

    return res.status(200).json({
      message: "Game verified and started",
    });
  } catch (err) {
    console.error("Play game error:", err);
    return res.status(500).json({ message: "Failed to start game" });
  }
};
