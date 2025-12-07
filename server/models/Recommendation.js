const RecommendationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  recommendations: [
    {
      post: { type: mongoose.Schema.Types.ObjectId, ref: "Post" },
      score: Number
    }
  ],
  generatedAt: { type: Date, default: Date.now }
});

export default mongoose.model("Recommendation", RecommendationSchema);