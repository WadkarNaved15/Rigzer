import express from "express";
import jwt from "jsonwebtoken";
import httpProxy from "http-proxy";
import crypto from "crypto";
import cacheService from "../services/cacheService.js";

const router = express.Router();

const proxy = httpProxy.createProxyServer({
  ws: true,
  changeOrigin: true,
  xfwd: true
});


const activeStreams = new Map();

// WebSocket support
router.use((req, res, next) => {
  if (req.headers.upgrade) {
    proxy.ws(req, req.socket, Buffer.alloc(0));
  }
  next();
});

// ✅ 1-to-1 flow — generate streamId from JWT
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


router.all("/:id*", (req, res, next) => {
  if (!req.originalUrl.endsWith("/") && !req.originalUrl.includes(".")) {
    return res.redirect(req.originalUrl.replace(/\/?$/, "/"));
  }
  next();
});

// ✅ Handles both 1-to-1 (UUID) and ASG (JWT token)
router.all("/:id*", async (req, res) => {
  const { id } = req.params;

  console.log(`[StreamProxy] Request: ${req.method} ${req.url}`);

  // ✅ 1-to-1 flow — check activeStreams Map first
  const instanceIpFromMap = activeStreams.get(id);
  if (instanceIpFromMap) {
    console.log(`[StreamProxy] 1-to-1 flow, proxying to http://${instanceIpFromMap}:8080`);
    return proxy.web(req, res, {
      target: `http://${instanceIpFromMap}:8080`,
      ignorePath: false,
      prependPath: false,
    });
  }

  // ✅ ASG flow — verify JWT and check Redis cache
  try {

    const payload = jwt.verify(id, process.env.STREAM_SECRET);
    console.log(`[StreamProxy] JWT verified for session: ${payload.sessionId} user: ${payload.userId}`);

    const cached = await cacheService.get(`stream:${payload.sessionId}`);
    console.log(`[StreamProxy] Cache result:`, cached);

    if (!cached) {
      console.log(`[StreamProxy] No cache found for stream:${payload.sessionId}`);
      return res.sendStatus(404);
    }

    if (cached.userId !== payload.userId) {
      console.log(`[StreamProxy] User mismatch: ${cached.userId} !== ${payload.userId}`);
      return res.sendStatus(403);
    }

    console.log(`[StreamProxy] ASG flow, proxying to http://${cached.instanceIp}:8080`);

const prefix = `/${id}`;

if (req.url.startsWith(prefix)) {
  req.url = req.url.slice(prefix.length) || "/";
}

proxy.web(req, res, {
  target: `http://${cached.instanceIp}:8080`,
  changeOrigin: true,
  headers: {
    "X-Forwarded-Proto": "https",
    "X-Forwarded-Host": req.headers.host,
  }
});

  } catch (err) {
    console.error(`[StreamProxy] Error: ${err.message}`);
    return res.sendStatus(401);
  }
});

// Proxy error handling
proxy.on("error", (err, req, res) => {
  console.error(`[StreamProxy] Proxy error:`, err.message);
  res.sendStatus(502);
});

export default router;