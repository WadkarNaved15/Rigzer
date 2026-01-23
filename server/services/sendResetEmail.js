import nodemailer from "nodemailer";

export const sendResetEmail = async (email, link) => {
  const transporter = nodemailer.createTransport({
    service: "Gmail", // or SMTP
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: `"Rigzer" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Reset your password",
    html: `
      <p>You requested a password reset.</p>
      <p><a href="${link}">Click here to reset your password</a></p>
      <p>This link expires in 15 minutes.</p>
    `,
  });
};
