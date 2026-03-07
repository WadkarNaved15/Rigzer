import User from "../models/User.js";
import Post from "../models/Allposts.js";
import Article from "../models/Canvas.js";
export const updateMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // ✅ ALLOWED FIELDS ONLY
    const allowedUpdates = [
      "username",
      "bio",
      "avatar",
      "banner",
      "socials",
    ];

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        user[field] = req.body[field];
      }
    });

    await user.save();

    res.status(200).json({
      message: "Profile updated successfully",
      user,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
export const getProfile = async (req, res) => {
  try {
    const { username } = req.params;

    const user = await User.findOne({ username });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const posts = await Post.find({
      user: user._id,
      type: { $ne: "canvas_article" }, // exclude canvas articles
    })
      .populate("user", "username avatar")
      .sort({ _id: -1 })
      .lean();

    const articles = await Article.find(
      {
        status: "published",
        ownerId: user._id,
      },
      {
        title: 1,
        subtitle: 1,
        hero_image_url: 1,
        author_name: 1,
        publishedAt: 1,
      }
    )
      .sort({ publishedAt: -1 })
      .lean();


    res.json({
      user,
      posts,
      articles,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
