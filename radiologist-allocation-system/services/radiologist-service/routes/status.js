import express from "express";
import { pool } from "../db/connect.js";
import { authMiddleware } from "../utils/auth.js";
import { sendStatusUpdate } from "../kafka/producer.js";

const router = express.Router();
router.use(authMiddleware);

const BLOCKING_STATUSES = new Set(["EMERGENCY_UNAVAILABLE", "OFFLINE", "MANUALLY_BLOCKED"]);

function normalizeStatus(status) {
  return String(status || "").trim().toUpperCase();
}

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, radiologist_code, name, availability, operational_status, unavailable_since, unavailable_until, unavailable_reason
       FROM radiologists
       WHERE id = $1`,
      [req.user.id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ ok: false, error: "Radiologist not found" });
    }

    res.json({ ok: true, data: result.rows[0] });
  } catch (err) {
    console.error("Status fetch error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.put("/", async (req, res) => {
  try {
    const radiologistId = req.user.id;
    const status = normalizeStatus(req.body.status);
    const reason = String(req.body.reason || "").trim() || null;
    const unavailableUntil = req.body.unavailable_until || null;

    if (!["AVAILABLE", "EMERGENCY_UNAVAILABLE", "OFFLINE", "MANUALLY_BLOCKED"].includes(status)) {
      return res.status(400).json({ ok: false, error: "Unsupported operational status" });
    }

    if (status === "AVAILABLE") {
      const leaveConflict = await pool.query(
        `SELECT 1
         FROM leave_requests
         WHERE radiologist_id = $1
           AND CURRENT_DATE BETWEEN start_date AND end_date
         LIMIT 1`,
        [radiologistId]
      );

      if (leaveConflict.rows.length) {
        return res.status(400).json({ ok: false, error: "Cannot resume availability during an active leave window" });
      }
    }

    const isBlocking = BLOCKING_STATUSES.has(status);
    const result = await pool.query(
      `UPDATE radiologists
       SET operational_status = $2,
           availability = CASE
             WHEN $3 THEN FALSE
             WHEN $2 = 'AVAILABLE' THEN EXISTS (
               SELECT 1
               FROM availability_slots slot
               WHERE slot.radiologist_id = radiologists.id
                 AND slot.is_booked = FALSE
                 AND NOW() BETWEEN slot.start_time AND slot.end_time
             )
             ELSE availability
           END,
           unavailable_since = CASE WHEN $3 THEN NOW() ELSE NULL END,
           unavailable_until = CASE WHEN $3 THEN $4::timestamp ELSE NULL END,
           unavailable_reason = CASE WHEN $3 THEN $5 ELSE NULL END
       WHERE id = $1
       RETURNING id, radiologist_code, name, availability, operational_status, unavailable_since, unavailable_until, unavailable_reason`,
      [radiologistId, status, isBlocking, unavailableUntil, reason]
    );

    const radiologist = result.rows[0];
    if (!radiologist) {
      return res.status(404).json({ ok: false, error: "Radiologist not found" });
    }

    await sendStatusUpdate({
      radiologist_id: radiologist.id,
      radiologist_code: radiologist.radiologist_code,
      status: radiologist.operational_status,
      reason: radiologist.unavailable_reason,
      unavailable_since: radiologist.unavailable_since,
      unavailable_until: radiologist.unavailable_until,
      changed_at: new Date().toISOString(),
    });

    res.json({ ok: true, data: radiologist });
  } catch (err) {
    console.error("Status update error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
