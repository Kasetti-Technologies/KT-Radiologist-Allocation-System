import express from "express";
import dotenv from "dotenv";
import healthRouter from "./routes/health.js";
import { connectConsumer } from "./kafka/consumer.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use("/api", healthRouter);

const PORT = process.env.PORT || 8081;

const start = async () => {
  try {
    await connectConsumer();
    app.listen(PORT, () => {
      console.log(`🚀 Validator Service running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to start Validator Service:", err);
    process.exit(1);
  }
};

start();
