import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true },
    email: { type: String, unique: true, required: true, lowercase: true },
    password: {
      type: String,
      required: function () {
        return !this.isGoogleUser;
      },
      select: false, // Don’t return by default
    },
    isGoogleUser: { type: Boolean, default: false },
    followersCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 },
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
    },
  },
  
  { timestamps: true }
);

userSchema.index({ username: 1 });

const User = mongoose.model("User", userSchema);
export default User;
