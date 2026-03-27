import express from "express";
import httpProxy from "http-proxy";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import cacheService from "../services/cacheService.js";

const router = express.Router();
router.use(cookieParser());

const proxy = httpProxy.createProxyServer({
  ws: true,
  changeOrigin: true,
  xfwd: true,
});

// Extract stream token from subdomain
function getStreamToken(hostname = "") {
  return hostname.split(".")[0];
}

// Verify auth cookie
function getUserIdFromCookie(req) {
  try {
    const token = req.cookies?.token;
    if (!token) return null;
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return payload.id ?? payload.userId ?? null;
  } catch {
    return null;
  }
}

/* ===============================
   HTTP Proxy for stream subdomain
================================ */
router.use(async (req, res) => {
  const streamToken = getStreamToken(req.hostname);

  if (!streamToken) return res.sendStatus(400);

  let cached;
  try {
    cached = await cacheService.get(`stream:${streamToken}`);
  } catch (err) {
    console.error("[StreamProxy] Cache error:", err);
    return res.sendStatus(500);
  }

  if (!cached) {
    console.warn(`[StreamProxy] No session for token: ${streamToken}`);
    return res.sendStatus(404);
  }

  //Auth User
 const userId = getUserIdFromCookie(req);
  if (!userId || userId !== cached.userId) {
    console.warn(`[StreamProxy] User ID mismatch for token: ${streamToken}
      Expected: ${cached.userId}, Got: ${userId}`);
    return res.sendStatus(403);
  }

  console.log(`[StreamProxy] → http://${cached.instanceIp}:8080${req.url}`);

  proxy.web(req, res, {
    target: `http://${cached.instanceIp}:8080`,
  });
});

/* ===============================
   Token-based streaming route
================================ */
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

    // Remove token from URL
    const rest = req.params[0] || "/";
    req.url = rest;

    console.log(`[StreamProxy] ASG → http://${cached.instanceIp}:8080${req.url}`);

    proxy.web(req, res, {
      target: `http://${cached.instanceIp}:8080`,
    });

  } catch (err) {
    console.error("[StreamProxy] Token verify error:", err);
    res.sendStatus(403);
  }
});

/* ===============================
   WebSocket Upgrade Handler
================================ */
export function handleWsUpgrade(req, socket, head) {
  const streamToken = getStreamToken(req.headers.host ?? "");

  cacheService.get(`stream:${streamToken}`)
    .then(cached => {
      if (!cached) {
        console.warn(`[StreamProxy] WS: No session for ${streamToken}`);
        return socket.destroy();
      }

      proxy.ws(req, socket, head, {
        target: `http://${cached.instanceIp}:8080`,
      });
    })
    .catch(err => {
      console.error("[StreamProxy] WS cache error:", err);
      socket.destroy();
    });
}

/* ===============================
   Proxy error handler
================================ */
proxy.on("error", (err, req, res) => {
  console.error("[StreamProxy] Proxy error:", err.message);
  if (res && !res.headersSent) {
    res.sendStatus(502);
  }
});

export default router;