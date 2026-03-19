import express from "express";
import jwt from "jsonwebtoken";
import httpProxy from "http-proxy";
import crypto from "crypto";
import cacheService from "../services/cacheService.js";

const router = express.Router();

const proxy = httpProxy.createProxyServer({
  ws: true,
  changeOrigin: true,
});

const activeStreams = new Map();

// WebSocket support
router.use((req, res, next) => {
  if (req.headers.upgrade) {
    proxy.ws(req, req.socket, Buffer.alloc(0));
  }
  next();
});

// ✅ 1-to-1 flow — unchanged
router.get("/start/:token", (req, res) => {
  let payload;
  try {
    payload = jwt.verify(req.params.token, process.env.STREAM_SECRET);
  } catch {
    return res.sendStatus(401);
  }
  const streamId = crypto.randomUUID();
  activeStreams.set(streamId, payload.instanceIp);
  res.redirect(`/api/stream/${streamId}/`);
});

// ✅ 1-to-1 flow — unchanged
router.all("/:streamId/*", (req, res) => {
  const { streamId } = req.params;
  const instanceIp = activeStreams.get(streamId);
  if (!instanceIp) {
    return res.sendStatus(401);
  }
  proxy.web(req, res, {
    target: `http://${instanceIp}:8080`,
    ignorePath: false,
    prependPath: false,
  });
});

// ✅ ASG flow — JWT token with no trailing path
router.all("/:token", async (req, res) => {
  try {
    const payload = jwt.verify(
      req.params.token,
      process.env.STREAM_SECRET
    );

    const cached = await cacheService.get(`stream:${payload.sessionId}`);

    if (!cached) return res.sendStatus(404);
    if (cached.userId !== payload.userId) return res.sendStatus(403);

    proxy.web(req, res, {
      target: `http://${cached.instanceIp}:8080`,
    });

  } catch (err) {
    return res.sendStatus(401);
  }
});

export default router;