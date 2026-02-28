import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

async function testSMTP() {
  try {
    console.log("Connecting to GoDaddy SMTP...");

    const transporter = nodemailer.createTransport({
      host: "smtpout.secureserver.net",
      port: 465, // try 587 if this fails
      secure: true, // SSL for 465
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Step 1: Verify connection
    await transporter.verify();
    console.log("✅ SMTP connection successful!");

    // Step 2: Send test email
    const info = await transporter.sendMail({
      from: `"Rigzer Test" <${process.env.EMAIL_USER}>`,
      to: "sayedusaid880@gmail.com", // <-- change this
      subject: "SMTP Test Email",
      text: "If you received this email, GoDaddy SMTP is working correctly.",
    });

    console.log("✅ Email sent successfully!");
    console.log("Message ID:", info.messageId);

  } catch (error) {
    console.error("❌ SMTP Test Failed:");
    console.error(error);
  }
}

testSMTP();