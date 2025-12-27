import express from "express";
import verifyToken from "../middlewares/authMiddleware.js";
import { playGame } from "../controllers/playGameAndVerify.js";

const router = express.Router();

router.post("/:postId/play", verifyToken, playGame);

export default router;
