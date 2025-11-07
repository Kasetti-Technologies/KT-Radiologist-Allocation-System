// services/allocator-service/routes/publish.js
import express from "express";
import { Kafka } from "kafkajs";

const router = express.Router();

// Initialize Kafka
const kafka = new Kafka({
  clientId: "allocator-publisher",
  brokers: [process.env.KAFKA_BROKER],
});

const producer = kafka.producer();
let connected = false;

async function ensureConnected() {
  if (!connected) {
    await producer.connect();
    connected = true;
    console.log("✅ Kafka producer connected for /api/publish");
  }
}

/**
 * POST /api/publish
 * Example body:
 * {
 *   "topic": "radiology.validated",
 *   "message": {
 *      "ticket_id": "CASE-MRI-101",
 *      "category": "MRI",
 *      "priority": "HIGH",
 *      "skills_required": ["MRI"],
 *      "sla_minutes": 2,
 *      "bahmni_url": "http://bahmni.example.com/report/CASE-MRI-101"
 *   }
 * }
 */
router.post("/", async (req, res) => {
  try {
    const { topic, message } = req.body;

    if (!topic || !message) {
      return res.status(400).json({
        ok: false,
        error: "Missing required fields: topic and message",
      });
    }

    await ensureConnected();
    await producer.send({
      topic,
      messages: [{ value: JSON.stringify(message) }],
    });

    console.log(`📤 Published message to topic ${topic}:`, message);
    res.json({ ok: true, topic, message });
  } catch (err) {
    console.error("❌ Publish error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
