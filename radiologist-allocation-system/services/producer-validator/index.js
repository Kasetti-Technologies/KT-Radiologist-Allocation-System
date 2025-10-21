// services/producer-validator/index.js
import express from "express";
import dotenv from "dotenv";
import { startConsumer } from "./kafka/consumer.js";
import healthRouter from "./routes/health.js";
import { metricsEndpoint } from "./metrics/metrics.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use("/api", healthRouter);

// ✅ Prometheus endpoint
app.get("/metrics", metricsEndpoint);

const PORT = process.env.PORT || 8081;

const start = async () => {
  await startConsumer();
  app.listen(PORT, () => {
    console.log(`🚀 Validator Service running on http://localhost:${PORT}`);
    console.log(`📊 Metrics available at http://localhost:${PORT}/metrics`);
  });
};

start();
