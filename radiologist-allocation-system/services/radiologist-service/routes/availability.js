// services/radiologist-service/routes/availability.js
import express from "express";
import { pool } from "../db/connect.js";
import { authMiddleware } from "../utils/auth.js";
import { sendAvailabilityUpdate } from "../kafka/producer.js";

const router = express.Router();
router.use(authMiddleware);

// POST /api/availability
router.post("/", async (req, res) => {
  try {
    const radiologist_id = req.user.id;
    const { start_time, end_time } = req.body;

    if (!start_time || !end_time) {
      return res.status(400).json({ ok: false, error: "start_time and end_time required" });
    }

    if (new Date(start_time) >= new Date(end_time)) {
      return res.status(400).json({ ok: false, error: "end_time must be after start_time" });
    }

    const overlap = await pool.query(
      `SELECT 1
       FROM availability_slots
       WHERE radiologist_id = $1
         AND tstzrange(start_time, end_time, '[)') && tstzrange($2::timestamp, $3::timestamp, '[)')
       LIMIT 1`,
      [radiologist_id, start_time, end_time]
    );

    if (overlap.rows.length) {
      return res.status(400).json({ ok: false, error: "Overlapping availability slot already exists" });
    }

    const result = await pool.query(
      `INSERT INTO availability_slots (radiologist_id, start_time, end_time, is_booked)
       VALUES ($1, $2, $3, FALSE)
       RETURNING *`,
      [radiologist_id, start_time, end_time]
    );

    await pool.query(
      `UPDATE radiologists
       SET availability = TRUE
       WHERE id = $1`,
      [radiologist_id]
    );

    await sendAvailabilityUpdate({
      radiologist_id,
      slot_id: result.rows[0].id,
      start_time: result.rows[0].start_time,
      end_time: result.rows[0].end_time,
      specialization: req.user.specialization || null,
    });

    res.json({ ok: true, data: result.rows[0] });
  } catch (err) {
    console.error("❌ Error inserting availability:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/availability
router.get("/", async (req, res) => {
  try {
    const radiologist_id = req.user.id;
    const result = await pool.query(
      "SELECT * FROM availability_slots WHERE radiologist_id = $1 ORDER BY start_time DESC",
      [radiologist_id]
    );
    res.json({ ok: true, data: result.rows });
  } catch (err) {
    console.error("❌ Error fetching availability:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
