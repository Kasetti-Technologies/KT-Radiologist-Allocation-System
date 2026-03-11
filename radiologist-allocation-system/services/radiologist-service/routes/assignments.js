// services/radiologist-service/routes/assignments.js
import express from "express";
import { pool } from "../db/connect.js";
import { authMiddleware } from "../utils/auth.js";

const router = express.Router();
router.use(authMiddleware);

// GET /api/assignments  -> list assignments for radiologist (from shared DB)
router.get("/", async (req, res) => {
  console.log("JWT USER:", req.user);
  try {
    const radiologist_id = req.user.id;
    // Pull assignments from the project's assignments table
    const q = `SELECT id, ticket_id, radiologist_id, radiologist_name, category, created_at, assigned_at, priority, status, sla_minutes,bahmni_url, assigned_at
               FROM assignments
               WHERE radiologist_id = $1
               ORDER BY assigned_at DESC 
               LIMIT 200`;
    const r = await pool.query(q, [radiologist_id]);
    // optionally add a Bahmni URL for a front-end link (if you have patient/study id in assignments raw data)
    const rows = r.rows.map(row => ({
      ...row,
      bahmni_url: `http://<bahmni-host>/bahmni/clinical/patient/${row.ticket_id}` // replace mapping as required
    }));
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/assignments/all   (admin view; optional)
router.get("/all", async (req, res) => {
  try {
    const r = await pool.query(`SELECT * FROM assignments ORDER BY created_at DESC LIMIT 500`);
    res.json({ ok: true, data: r.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
