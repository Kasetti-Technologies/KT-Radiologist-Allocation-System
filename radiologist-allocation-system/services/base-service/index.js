import express from "express";
import dotenv from "dotenv";
import healthRouter from "./routes/health.js";
import { connectProducer } from "./kafka/producer.js";

dotenv.config();
console.log("📦 Loaded Kafka broker from env:", process.env.KAFKA_BROKER);

const app = express();
app.use(express.json());
app.use("/api", healthRouter);

const PORT = process.env.PORT || 8080;

const start = async () => {
  try {
    await connectProducer();

    // 🔹 Temporary test message
    await connectProducer("radiology-events", {
      ticket_id: "TEST-001",
      category: "X-RAY",
      priority: "High",
      created_at: new Date().toISOString(),
      message: "Kafka connection successful between Base Service and Validator!",
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
