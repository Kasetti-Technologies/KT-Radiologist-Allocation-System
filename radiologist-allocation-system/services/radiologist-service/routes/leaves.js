import express from "express";
import { pool } from "../db/connect.js";
import { authMiddleware } from "../utils/auth.js";
import { sendLeaveUpdate } from "../kafka/producer.js";

const router = express.Router();
router.use(authMiddleware);

router.post("/", async (req, res) => {
  try {
    const { start_date, end_date, reason } = req.body;
    if (!start_date || !end_date) {
      return res.status(400).json({ ok: false, error: "start_date and end_date are required" });
    }

    if (new Date(start_date) > new Date(end_date)) {
      return res.status(400).json({ ok: false, error: "end_date must be on or after start_date" });
    }

    const overlap = await pool.query(
      `SELECT 1
       FROM leave_requests
       WHERE radiologist_id = $1
         AND daterange(start_date, end_date + 1, '[)') && daterange($2::date, $3::date + 1, '[)')
       LIMIT 1`,
      [req.user.id, start_date, end_date]
    );

    if (overlap.rows.length) {
      return res.status(400).json({ ok: false, error: "Overlapping leave request already exists" });
    }

    const r = await pool.query(
      `INSERT INTO leave_requests (radiologist_id, start_date, end_date, reason)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.id, start_date, end_date, reason]
    );

    await pool.query(
      `UPDATE radiologists
       SET availability = FALSE
       WHERE id = $1
         AND CURRENT_DATE BETWEEN $2::date AND $3::date`,
      [req.user.id, start_date, end_date]
    );

    await sendLeaveUpdate({
      radiologist_id: req.user.id,
      start_date,
      end_date,
      reason: reason || null,
    });

    res.json({ ok: true, data: r.rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         id,
         start_date,
         end_date,
         reason,
         status,
         created_at,
         CASE
           WHEN CURRENT_DATE < start_date THEN 'UPCOMING'
           WHEN CURRENT_DATE BETWEEN start_date AND end_date THEN 'ACTIVE'
           ELSE 'COMPLETED'
         END AS display_status
       FROM leave_requests
       WHERE radiologist_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json({ ok: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
