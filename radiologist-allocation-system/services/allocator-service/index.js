// services/allocator-service/index.js
import express from "express";
import dotenv from "dotenv";
import { runMigrations } from "./db/migrations.js";
import { startConsumer } from "./kafka/consumer.js";
import { connectProducer } from "./kafka/producer.js";
import healthRouter from "./routes/health.js";
import client from "prom-client";
import { startRebalancer } from "./jobs/rebalancer.js";
import { startSlaMonitor } from "./slaMonitor.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use("/api", healthRouter);

const PORT = process.env.PORT || 8082;

// Prometheus registry
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// Counters / Gauges
export const allocationsCounter = new client.Counter({
  name: "allocator_assignments_total",
  help: "Total number of assignments processed",
  labelNames: ["radiologist", "category"],
});
register.registerMetric(allocationsCounter);

export const slaGauge = new client.Gauge({
  name: "allocator_sla_minutes",
  help: "Latest SLA (in minutes) per category",
  labelNames: ["category"],
});
register.registerMetric(slaGauge);

export const slaBreachesCounter = new client.Counter({
  name: "allocator_sla_breaches_total",
  help: "Total number of SLA breaches detected",
});
register.registerMetric(slaBreachesCounter);

export const reassignmentsCounter = new client.Counter({
  name: "allocator_reassignments_total",
  help: "Total number of automatic reassignments performed",
});
register.registerMetric(reassignmentsCounter);

// metrics HTTP endpoint
app.get("/metrics", async (req, res) => {
  try {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).send("Error collecting metrics: " + err.message);
  }
});

const start = async () => {
  await runMigrations();
  await connectProducer();
  await startConsumer();

  // Optional: rebalancer job (you already referenced it)
  try {
    startRebalancer();
  } catch (e) {
    console.warn("⚠️ startRebalancer failed to start:", e.message);
  }

  // start SLA monitor
  try {
    startSlaMonitor();
  } catch (e) {
    console.warn("⚠️ startSlaMonitor failed to start:", e.message);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Allocator Service running on http://localhost:${PORT}`);
    console.log(`📊 Metrics available at http://localhost:${PORT}/metrics`);
  });
};

start();
