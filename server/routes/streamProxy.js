// routes/streamProxy.js
import express from "express";
import jwt from "jsonwebtoken";
import httpProxy from "http-proxy";
import crypto from "crypto";

const router = express.Router();
const proxy = httpProxy.createProxyServer({
  ws: true,
  changeOrigin: true,
});

const activeStreams = new Map(); // streamId → instanceIp

router.get("/start/:token", (req, res) => {
  let payload;
  try {
    payload = jwt.verify(req.params.token, process.env.STREAM_SECRET);
  } catch {
    return res.sendStatus(401);
  }

  const streamId = crypto.randomUUID();
  activeStreams.set(streamId, payload.instanceIp);

  // 🔥 redirect browser to clean URL
  res.redirect(`/api/stream/${streamId}/`);
});


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

export default router;