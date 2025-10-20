// services/producer-validator/index.js
import express from "express";
import dotenv from "dotenv";
import { startConsumer } from "./kafka/consumer.js";
import healthRouter from "./routes/health.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use("/api", healthRouter);

const PORT = process.env.PORT || 8081;

const start = async () => {
  await startConsumer();
  app.listen(PORT, () => {
    console.log(`🚀 Validator Service running on http://localhost:${PORT}`);
  });
};

startConsumer();
