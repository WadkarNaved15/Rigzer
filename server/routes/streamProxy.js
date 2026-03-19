import express from "express";
import jwt from "jsonwebtoken";
import httpProxy from "http-proxy";
import cacheService from "../services/cacheService.js";

const router = express.Router();

const proxy = httpProxy.createProxyServer({
  ws: true,
  changeOrigin: true,
});

// WebSocket support
router.use((req, res, next) => {
  if (req.headers.upgrade) {
    proxy.ws(req, req.socket, Buffer.alloc(0));
  }
  next();
});

router.all("/:token*", async (req, res) => {
  try {
    const payload = jwt.verify(
      req.params.token,
      process.env.STREAM_SECRET
    );

    const cached = await cacheService.get(
      `stream:${payload.sessionId}`
    );

    if (!cached) return res.sendStatus(404);
    if (cached.userId !== payload.userId)
      return res.sendStatus(403);

    proxy.web(req, res, {
      target: `http://${cached.instanceIp}:8080`,
    });

  } catch (err) {
    return res.sendStatus(401);
  }
});

export default router;