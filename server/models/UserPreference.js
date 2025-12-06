const UserPreferenceSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  preferredTags: [{ type: String }],
  preferredEngines: [{ type: String }],
  preferredGenres: [{ type: String }],
  dislikedTags: [{ type: String }],
  
}, { timestamps: true });

export default mongoose.model("UserPreference", UserPreferenceSchema);