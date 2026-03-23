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

router.all("/:id*", async (req, res) => {
  const { id } = req.params;
  const rest = req.params[0] || "";

  console.log(`[StreamProxy] ${req.method} id=${id} rest="${rest}"`);

  // ✅ Redirect to add trailing slash for initial page load
  // so browser resolves relative assets correctly
  if (rest === "" && !req.url.endsWith("/")) {
    if (activeStreams.has(id)) {
      return res.redirect(301, `/api/stream/${id}/`);
    }
    try {
      jwt.verify(id, process.env.STREAM_SECRET);
      return res.redirect(301, `/api/stream/${id}/`);
    } catch {
      return res.sendStatus(401);
    }
  }

  // ✅ 1-to-1 flow
  const instanceIpFromMap = activeStreams.get(id);
  if (instanceIpFromMap) {
    req.url = rest || "/";
    console.log(`[StreamProxy] 1-to-1 → http://${instanceIpFromMap}:8080${req.url}`);
    return proxy.web(req, res, {
      target: `http://${instanceIpFromMap}:8080`,
    });
  }

  // ✅ ASG flow
  try {
    const payload = jwt.verify(id, process.env.STREAM_SECRET);
    const cached = await cacheService.get(`stream:${payload.sessionId}`);

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