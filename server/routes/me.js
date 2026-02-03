import express from "express";
import { updateMe} from "../controllers/user.controller.js";
import  verifyToken from "../middlewares/authMiddleware.js";

const router = express.Router();

router.patch("/", verifyToken, updateMe); // 👈 PATCH endpoint

export default router;
