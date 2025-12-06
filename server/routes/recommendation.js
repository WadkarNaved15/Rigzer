import express from "express";
import UserInteraction from "../models/UserInteraction.js";
import Post from "../models/RecommendationPost.js";
import verfiyToken from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", verfiyToken, async (req, res) => {
    try {
        const userId = req.user.id;

        // 1. Fetch all interactions for this user
        const interactions = await UserInteraction.find({ user: userId })
            .populate("post");

        if (!interactions.length)
            return res.json({
                preferences: { topTags: {}, topGenres: {} },
                recommendations: []
            });

        // 2. Build interest scores from user interactions
        const interestScores = interactions
            .filter(i => i.post !== null) // remove null posts
            .map(i => {
                const minutesPlayed = i.playTime ? i.playTime / 60 : 0;

                const score =
                    (i.playedDemo ? 40 : 0) +
                    minutesPlayed * 0.5 +
                    (i.liked ? 20 : 0) +
                    (i.commented ? 10 : 0) +
                    (i.rating ? i.rating * 10 : 0);

                return { post: i.post, score };
            });

        // 3. From top 5 interactions extract user preferences
        const topLiked = interestScores
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);

        let tagFrequency = {};
        let genreFrequency = {};

        topLiked.forEach(t => {
            if (!t.post) return;

            // Count tags
            if (Array.isArray(t.post.tags)) {
                t.post.tags.forEach(tag => {
                    tagFrequency[tag] = (tagFrequency[tag] || 0) + 1;
                });
            }

            // Count genre
            if (t.post.genre) {
                genreFrequency[t.post.genre] =
                    (genreFrequency[t.post.genre] || 0) + 1;
            }
        });

        // 4. Fetch ALL posts (game + normal)
        const allPosts = await Post.find();

        // 5. Score each post using user preferences
        const results = allPosts.map(p => {
            let matchScore = 0;

            // TAG MATCH SCORE
            if (Array.isArray(p.tags)) {
                p.tags.forEach(tag => {
                    if (tagFrequency[tag])
                        matchScore += tagFrequency[tag] * 10;
                });
            }

            // GENRE MATCH SCORE
            if (genreFrequency[p.genre]) {
                matchScore += genreFrequency[p.genre] * 20;
            }

            // GAME-ONLY METRICS
            if (p.type === "game_post") {
                matchScore += (p.playCount || 0) / 100;
                matchScore += (p.returnRate || 0) / 2;
                matchScore += (p.completionRate || 0) / 4;
                matchScore -= (p.rageQuitRate || 0);
            }

            return { post: p, score: matchScore };
        });

        // 6. Sort all results
        results.sort((a, b) => b.score - a.score);

        res.json({
            preferences: {
                topTags: tagFrequency,
                topGenres: genreFrequency,
            },
            recommendations: results.slice(0, 15), // return top 15 mixed posts
        });

    } catch (err) {
        console.error("Recommendation Error:", err);
        res.status(500).json({ message: "Server Error" });
    }
});

export default router;
