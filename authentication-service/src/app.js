import express from "express";
import bodyParser from "body-parser";
import { requestOtp, verifyOtp } from "./controllers/authController.js";

const app = express();
app.use(bodyParser.json());

app.post("/auth/request-otp", requestOtp);
app.post("/auth/verify-otp", verifyOtp);

app.get("/health", (req, res) => res.json({ status: "ok" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Auth service running on port ${PORT}`));
