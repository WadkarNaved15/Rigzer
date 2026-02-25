import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "smtpout.secureserver.net",
  port: 465,
  secure: true, // SSL
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Verify once at server startup
transporter.verify((error) => {
  if (error) {
    console.error("❌ SMTP connection error:", error);
  } else {
    console.log("✅ GoDaddy SMTP is ready");
  }
});

export default transporter;