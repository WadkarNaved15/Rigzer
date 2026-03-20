import User from "../models/User.js";
import Follow from "../models/Follow.js";
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

export const getProfileByUsername = async (req, res) => {
  try {
    const { username } = req.params;
    const currentUserId = req.user?._id; // from auth middleware

    const user = await User.findOne({ username })
      .select("username avatar banner bio socials")
      .lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let isFollowing = false;

    if (currentUserId) {
      const exists = await Follow.exists({
        follower: currentUserId,
        following: user._id,
      });

      isFollowing = !!exists;
    }

    res.status(200).json({
      ...user,
      isFollowing, // ✅ ADD THIS
    });

  } catch (err) {
    console.error("Profile fetch error:", err);
    res.status(500).json({ message: "Server error" });
  }
};