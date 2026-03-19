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

    if (!cached) {
      console.log(`[StreamProxy] Cache miss for stream:${payload.sessionId}`);
      return res.sendStatus(404);
    }

    if (cached.userId !== payload.userId) {
      console.log(`[StreamProxy] User mismatch`);
      return res.sendStatus(403);
    }

    // ✅ Strip JWT from URL — instance serves assets from root
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