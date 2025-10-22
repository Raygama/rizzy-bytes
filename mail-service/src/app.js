import express from "express";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const SMTP_HOST = process.env.SMTP_HOST || "mailhog";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "1025", 10);
const SMTP_FROM = process.env.SMTP_FROM || "no-reply@helpdesk.local";

// Mail transporter (MailHog in dev)
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: false
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.post("/send", async (req, res) => {
  try {
    const { to, subject, text, html } = req.body;
    await transporter.sendMail({ from: SMTP_FROM, to, subject, text, html });
    res.json({ sent: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`Mail service listening on ${PORT}`));
