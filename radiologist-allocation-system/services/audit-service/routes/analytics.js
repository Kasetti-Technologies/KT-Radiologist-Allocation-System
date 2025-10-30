// services/audit-service/routes/analytics.js
import express from "express";
import { pool } from "../db/connect.js";

const router = express.Router();

router.get("/audit-summary", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        radiologist_name,
        category,
        action,
        COUNT(*) as total
      FROM audit_logs
      GROUP BY radiologist_name, category, action
      ORDER BY total DESC
      LIMIT 20;
    `);

    res.json({ ok: true, data: result.rows });
  } catch (err) {
    console.error("❌ Failed to fetch audit summary:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
