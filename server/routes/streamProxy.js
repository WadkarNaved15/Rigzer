import express from "express";
import jwt from "jsonwebtoken";
import httpProxy from "http-proxy";
import crypto from "crypto";
import cacheService from "../services/cacheService.js";

const router = express.Router();

const proxy = httpProxy.createProxyServer({
  ws: true,
  changeOrigin: true,
  xfwd: true,
});

const activeStreams = new Map();

// WebSocket support
router.use((req, res, next) => {
  if (req.headers.upgrade) {
    proxy.ws(req, req.socket, Buffer.alloc(0));
  }
  next();
});

// ✅ 1-to-1 flow
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

// ✅ JWT token — redirect to add trailing slash so browser resolves assets correctly
// ✅ JWT token — only redirect if no trailing slash
router.get("/:token", async (req, res) => {
  const { token } = req.params;

  // 1-to-1 UUID
  if (activeStreams.has(token)) {
    return res.redirect(`/api/stream/${token}/`);
  }

  // ASG JWT
  try {
    jwt.verify(token, process.env.STREAM_SECRET);
    return res.redirect(`/api/stream/${token}/`);
  } catch {
    return res.sendStatus(401);
  }
});

// ✅ All requests with trailing slash — proxy to instance
// ✅ Handle both /TOKEN and /TOKEN/ — no redirect needed
router.all("/:id*", async (req, res) => {
  const { id } = req.params;
  const rest = req.params[0] || "/";

  console.log(`[StreamProxy] Request: ${req.method} ${req.url} id=${id} rest=${rest}`);

  // 1-to-1 flow
  const instanceIpFromMap = activeStreams.get(id);
  if (instanceIpFromMap) {
    console.log(`[StreamProxy] 1-to-1 → http://${instanceIpFromMap}:8080${rest}`);
    req.url = rest || "/";
    return proxy.web(req, res, {
      target: `http://${instanceIpFromMap}:8080`,
    });
  }

  // ASG flow
  try {
    const payload = jwt.verify(id, process.env.STREAM_SECRET);

    const cached = await cacheService.get(`stream:${payload.sessionId}`);
    if (!cached) return res.sendStatus(404);
    if (cached.userId !== payload.userId) return res.sendStatus(403);

    req.url = rest || "/";
    console.log(`[StreamProxy] ASG → http://${cached.instanceIp}:8080${req.url}`);

    proxy.web(req, res, {
      target: `http://${cached.instanceIp}:8080`,
      headers: {
        "X-Forwarded-Proto": "https",
        "X-Forwarded-Host": req.headers.host,
      },
    });

  } catch (err) {
    console.error(`[StreamProxy] Error: ${err.message}`);
    return res.sendStatus(401);
  }
});

proxy.on("error", (err, req, res) => {
  console.error(`[StreamProxy] Proxy error:`, err.message);
  res.sendStatus(502);
});

export default router;