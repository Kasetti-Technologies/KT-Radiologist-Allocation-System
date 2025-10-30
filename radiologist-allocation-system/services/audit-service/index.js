// services/audit-service/index.js
import express from "express";
import dotenv from "dotenv";
import register, { auditEventCounter, radiologistActivityGauge } from "./metrics/prometheus.js";
import { startConsumer } from "./kafka/consumer.js";
import analyticsRouter from "./routes/analytics.js";
import { pool } from "./db/connect.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8085;

// Middleware
app.use(express.json());

// Routes
app.use("/analytics", analyticsRouter);

// Prometheus metrics endpoint
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

// Run migrations (if not already)
const initDB = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      ticket_id TEXT,
      radiologist_id INT,
      radiologist_name TEXT,
      category TEXT,
      action TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      raw_event JSONB
    );
  `);
  console.log("✅ Audit Service connected to Postgres");
};

// Start
(async () => {
  await initDB();
  await startConsumer();
  app.listen(PORT, () =>
    console.log(`🪶 Audit Service running on http://localhost:${PORT}`)
  );
})();
