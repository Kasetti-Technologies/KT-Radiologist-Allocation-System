// services/allocator-service/index.js
import express from "express";
import dotenv from "dotenv";
import { runMigrations } from "./db/migrations.js";
import { startConsumer } from "./kafka/consumer.js";
import { connectProducer } from "./kafka/producer.js";
import healthRouter from "./routes/health.js";

dotenv.config();
const app = express();
app.use(express.json());
app.use("/api", healthRouter);

const PORT = process.env.PORT || 8082;

const start = async () => {
  await runMigrations();
  await connectProducer();
  await startConsumer();

  app.listen(PORT, () => {
    console.log(`🚀 Allocator Service running on http://localhost:${PORT}`);
  });
};

start();
