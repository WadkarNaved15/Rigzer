import nodemailer from "nodemailer";

export const sendResetEmail = async (email, link) => {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true, // Use SSL
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    // This helps bypass some network timeout issues in cloud environments
    connectionTimeout: 10000, 
  });

  await transporter.sendMail({
    from: `"Rigzer" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Reset your password",
    html: `
      <div style="font-family: sans-serif; padding: 20px;">
        <h3>Password Reset Request</h3>
        <p>You requested a password reset for your account.</p>
        <p><a href="${link}" style="background: #007bff; color: white; padding: 10px 15px; text-decoration: none; border-radius: 5px;">Reset Password</a></p>
        <p>If the button doesn't work, copy and paste this link:</p>
        <p>${link}</p>
        <p>This link expires in 15 minutes.</p>
      </div>
    `,
  });
};