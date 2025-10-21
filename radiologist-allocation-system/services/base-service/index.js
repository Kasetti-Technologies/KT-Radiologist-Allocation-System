// services/base-service/index.js
import express from "express";
import dotenv from "dotenv";
import healthRouter from "./routes/health.js";
import { connectProducer, sendMessage } from "./kafka/producer.js";
import client from "prom-client";

dotenv.config();
console.log("📦 Loaded Kafka broker from env:", process.env.KAFKA_BROKER);

const app = express();
app.use(express.json());
app.use("/api", healthRouter);

const PORT = process.env.PORT || 8080;

// ✅ Setup Prometheus metrics
const register = new client.Registry();
client.collectDefaultMetrics({ register });
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

// ✅ Route: Send validated event manually (via Postman)
app.post("/api/send-validated", async (req, res) => {
  try {
    const payload = req.body;
    console.log("📤 Sending validated event:", payload);

    await sendMessage("radiology.validated", payload);

    return res.json({
      status: "success",
      topic: "radiology.validated",
      message: "Event sent to Kafka successfully",
    });
  } catch (err) {
    console.error("❌ Failed to send validated event:", err);
    res.status(500).json({ status: "error", error: err.message });
  }
});

// ✅ Route: Send intentionally invalid message
app.post("/api/test-invalid", async (req, res) => {
  const invalidPayload = {
    ticket_id: "INVALID-001",
    category: "CT",
    priority: "high",
  };

  await sendMessage("radiology-events", invalidPayload);
  return res.json({
    status: "sent",
    message: "Invalid message published to Kafka",
  });
});

const start = async () => {
  try {
    await connectProducer();

    // Send a sample valid test message on startup
    await sendMessage("radiology-events", {
      ticket_id: "TEST-001",
      source_system: "RadiologySystem",
      category: "X-RAY",
      priority: 1,
      created_at: new Date().toISOString(),
      skills_required: ["Radiologist"],
      sla_minutes: 30,
      provenance: {
        producer_id: "base-service",
        producer_version: "1.0.0",
      },
    });

    app.listen(PORT, () => {
      console.log(`🚀 Base Service running on http://localhost:${PORT}`);
      console.log(`📊 Metrics available at http://localhost:${PORT}/metrics`);
      console.log(`✅ Test route: POST http://localhost:${PORT}/api/send-validated`);
    });
  } catch (err) {
    console.error("❌ Failed to start Base Service:", err);
    process.exit(1);
  }
};

start();
