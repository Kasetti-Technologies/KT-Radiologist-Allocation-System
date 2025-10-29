// services/allocator-service/routes/health.js
import express from "express";
import { pool } from "../db/connect.js";
const router = express.Router();

router.get("/health", (req, res) => {
  res.json({ status: "ok", service: "allocator-service" });
});

// 🧪 Test route — create a breached SLA assignment
router.post("/test-create-breached", async (req, res) => {
  try {
    const { ticket_id, radiologist_id, sla_minutes, created_minutes_ago, priority, category } = req.body;
    const created_at = new Date(Date.now() - created_minutes_ago * 60 * 1000); // backdate

    await pool.query(
      `INSERT INTO assignments (ticket_id, radiologist_id, assigned_at, priority, sla_minutes, category, status, escalated, created_at)
       VALUES ($1, $2, NOW(), $3, $4, $5, 'PENDING', false, $6)
       RETURNING *`,
      [ticket_id, radiologist_id, priority, sla_minutes, category, created_at]
    );

    res.json({ ok: true, ticket_id });
  } catch (err) {
    console.error("❌ Error inserting breached ticket:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
