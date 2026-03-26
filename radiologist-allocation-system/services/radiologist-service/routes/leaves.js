import express from "express";
import { pool } from "../db/connect.js";
import { authMiddleware } from "../utils/auth.js";

const router = express.Router();
router.use(authMiddleware);

router.post("/", async (req, res) => {
  try {
    const { start_date, end_date, reason } = req.body;
    const r = await pool.query(
      `INSERT INTO leave_requests (radiologist_id, start_date, end_date, reason)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.id, start_date, end_date, reason]
    );
    res.json({ ok: true, data: r.rows[0] });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, start_date, end_date, reason, status, created_at
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
