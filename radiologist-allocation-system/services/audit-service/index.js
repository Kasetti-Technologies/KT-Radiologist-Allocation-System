// services/audit-service/index.js
import express from "express";
import dotenv from "dotenv";
import register, { auditEventCounter, radiologistActivityGauge } from "./metrics/prometheus.js";
import { startConsumer } from "./kafka/consumer.js";
import analyticsRouter from "./routes/analytics.js";
import { runMigrations } from "./db/migrations.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 8085;

app.use(express.json());
app.use("/analytics", analyticsRouter);

// Prometheus metrics endpoint
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

// Health endpoint
app.get("/health", (_, res) => res.json({ ok: true, service: "audit-service" }));

// Initialize DB and start consumer
(async () => {
  await runMigrations();
  await startConsumer();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🪶 Audit Service running on http://localhost:${PORT}`);
    console.log(`📊 Metrics available at http://localhost:${PORT}/metrics`);
  });
})();
