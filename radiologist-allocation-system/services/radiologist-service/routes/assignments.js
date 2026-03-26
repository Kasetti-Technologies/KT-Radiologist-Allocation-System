// services/radiologist-service/routes/assignments.js
import express from "express";
import { pool } from "../db/connect.js";
import { authMiddleware } from "../utils/auth.js";
import { sendCompletionEvent } from "../kafka/producer.js";

const router = express.Router();
router.use(authMiddleware);

function buildBahmniUrl(row) {
  if (row.bahmni_url) return row.bahmni_url;

  const baseUrl = process.env.BAHMNI_BASE_URL?.trim();
  if (!baseUrl) return null;

  const normalizedBase = baseUrl.replace(/\/+$/, "");
  return `${normalizedBase}/bahmni/clinical/patient/${encodeURIComponent(row.ticket_id)}`;
}

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
    const rows = r.rows.map(row => ({
      ...row,
      bahmni_url: buildBahmniUrl(row)
    }));
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.put("/:id/complete", async (req, res) => {
  try {
    const assignmentId = req.params.id;
    const radiologistId = req.user.id;

    const updateResult = await pool.query(
      `UPDATE assignments
       SET status = 'COMPLETED',
           completed_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
         AND radiologist_id = $2
         AND status <> 'COMPLETED'
       RETURNING id, ticket_id, radiologist_id, status, completed_at`,
      [assignmentId, radiologistId]
    );

    if (!updateResult.rows.length) {
      return res.status(404).json({ ok: false, error: "Assignment not found or already completed" });
    }

    const assignment = updateResult.rows[0];

    await sendCompletionEvent({
      case_id: assignment.ticket_id,
      radiologist_id: assignment.radiologist_id,
      completed_at: assignment.completed_at,
    });

    res.json({ ok: true, data: assignment });
  } catch (err) {
    console.error("Assignment completion error:", err);
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
