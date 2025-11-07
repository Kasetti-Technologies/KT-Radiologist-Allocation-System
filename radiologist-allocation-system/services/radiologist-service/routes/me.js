// services/radiologist-service/routes/me.js
import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { pool } from "../db/connect.js";
const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const { radiologist_id } = req.user;
    if (!radiologist_id) return res.json({ ok: true, user: req.user });

    const r = await pool.query(`SELECT id, name, specialization, availability, assigned_count FROM radiologists WHERE id = $1`, [radiologist_id]);
    res.json({ ok: true, user: req.user, radiologist: r.rows[0] || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
