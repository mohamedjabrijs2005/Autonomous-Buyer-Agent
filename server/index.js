import express from "express";
import cors from "cors";
import basicRoutes from "./routes/basic.js";
import agentRunRoutes from "./routes/agentRun.js";

const app = express();

// FRONTEND_URL should be your deployed frontend's origin (e.g.
// https://your-app.vercel.app). Falls back to allowing all origins if
// unset, which is fine for local dev and hackathon demos, but set it once
// you have a real frontend URL.
const allowedOrigin = process.env.FRONTEND_URL;
app.use(cors(allowedOrigin ? { origin: allowedOrigin } : {}));
app.use(express.json());

app.use(basicRoutes);
app.use(agentRunRoutes);

app.get("/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Agentic commerce server running on http://localhost:${PORT}`);
  console.log(`GROQ_API_KEY set: ${Boolean(process.env.GROQ_API_KEY)}`);
  console.log(`Razorpay keys set: ${Boolean(process.env.RAZORPAY_KEY_ID)}`);
});
