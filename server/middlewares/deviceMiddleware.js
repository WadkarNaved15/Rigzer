import crypto from "crypto";

export default function deviceMiddleware(req, res, next) {
  let deviceId = req.cookies.device_id;

  if (!deviceId) {
    deviceId = crypto.randomUUID();
    res.cookie("device_id", deviceId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 365 * 24 * 60 * 60 * 1000
    });
  }

  req.deviceId = deviceId; 
  next();
}
