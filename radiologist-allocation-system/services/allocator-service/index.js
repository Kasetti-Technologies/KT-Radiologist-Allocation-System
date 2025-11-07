// services/allocator-service/index.js
import express from "express";
import dotenv from "dotenv";
import { runMigrations } from "./db/migrations.js";
import { startConsumer } from "./kafka/consumer.js";
import { connectProducer, producer } from "./kafka/producer.js";
import healthRouter from "./routes/health.js";
import publishRouter from "./routes/publish.js";
import client from "prom-client";
import { startRebalancer } from "./jobs/rebalancer.js";
import { startSlaMonitor } from "./slaMonitor.js";

dotenv.config();
const app = express();
app.use(express.json());

// Mount routes first
app.use("/api/health", healthRouter);
app.use("/api/publish", publishRouter);

// --- Prometheus metrics setup ---
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// 🧩 EXPORT metrics counters so other modules can import safely
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

// --- Metrics endpoint ---
app.get("/metrics", async (req, res) => {
  try {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).send("Error collecting metrics: " + err.message);
  }
});

// --- Manual test: simulate validated case ---
app.post("/api/case/validated", async (req, res) => {
  const { ticket_id, category, priority, skills_required, sla_minutes } = req.body;
  if (!ticket_id || !category)
    return res.status(400).json({ ok: false, error: "ticket_id and category required" });

  try {
    await producer.send({
      topic: "radiology.validated",
      messages: [
        {
          value: JSON.stringify({
            ticket_id,
            category,
            priority: priority || "MEDIUM",
            skills_required: skills_required || [category],
            sla_minutes: sla_minutes || 30,
            created_at: new Date().toISOString(),
          }),
        },
      ],
    });
    console.log(`📤 Published validated case: ${ticket_id}`);
    res.json({ ok: true, message: `Case ${ticket_id} sent to Kafka` });
  } catch (err) {
    console.error("❌ Kafka publish error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Start service ---
const PORT = process.env.PORT || 8082;
const start = async () => {
  await runMigrations();
  await connectProducer();
  await startConsumer();
  startRebalancer();
  startSlaMonitor();

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Allocator Service running at http://localhost:${PORT}`);
    console.log(`📊 Metrics available at http://localhost:${PORT}/metrics`);
  });
};

start();
