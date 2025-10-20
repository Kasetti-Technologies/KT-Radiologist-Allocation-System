// services/base-service/index.js
import express from "express";
import dotenv from "dotenv";
import healthRouter from "./routes/health.js";
import { connectProducer, sendMessage } from "./kafka/producer.js";

dotenv.config();
console.log("📦 Loaded Kafka broker from env:", process.env.KAFKA_BROKER);

const app = express();
app.use(express.json());
app.use("/api", healthRouter);

const PORT = process.env.PORT || 8080;

const start = async () => {
  try {
    await connectProducer();

    // ✅ Default valid test message (run once at startup)
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

    // ✅ New route — intentionally invalid payload
    app.post("/api/test-invalid", async (req, res) => {
      const invalidPayload = {
        ticket_id: "INVALID-001",
        category: "CT", // ❌ missing required fields like source_system, provenance
        priority: "high", // ❌ wrong type (should be integer)
      };

      await sendMessage("radiology-events", invalidPayload);
      return res.json({ status: "sent", message: "Invalid message published to Kafka" });
    });

    app.listen(PORT, () => {
      console.log(`🚀 Base Service running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to start Base Service:", err);
    process.exit(1);
  }
};

start();
