// services/radiologist-service/routes/radiologists.js
import express from "express";
import { pool } from "../db/connect.js";
import { sendStatusUpdate } from "../kafka/producer.js";
const router = express.Router();

function requireAdminVerification(req, res, next) {
  const expectedKey = process.env.ADMIN_VERIFICATION_KEY;
  if (expectedKey && req.headers["x-admin-key"] !== expectedKey) {
    return res.status(403).json({ ok: false, error: "Invalid admin verification key" });
  }

  next();
}

router.get("/", async (req, res) => {
  const result = await pool.query(
    `SELECT
       id,
       radiologist_code,
       name,
       email,
       specialization,
       experience_years,
       certification_number,
       certification_authority,
       certification_verified,
       verification_status,
       certification_verified_at,
       certification_verified_by,
       availability,
       operational_status
     FROM radiologists
     ORDER BY id ASC`
  );
  res.json({ ok: true, data: result.rows });
});

router.put("/:id/verification", requireAdminVerification, async (req, res) => {
  try {
    const radiologistId = req.params.id;
    const verified = Boolean(req.body.verified);
    const verifiedBy = String(req.body.verified_by || "operations").trim();
    const parsedExperienceYears = req.body.experience_years === undefined
      ? null
      : Number.parseInt(req.body.experience_years, 10);
    const status = verified ? "VERIFIED" : "REJECTED";

    if (parsedExperienceYears !== null && (Number.isNaN(parsedExperienceYears) || parsedExperienceYears < 0 || parsedExperienceYears > 60)) {
      return res.status(400).json({ ok: false, error: "experience years must be between 0 and 60" });
    }

    const result = await pool.query(
      `UPDATE radiologists
       SET certification_verified = $2,
           verification_status = $3,
           certification_verified_at = CASE WHEN $2 THEN NOW() ELSE NULL END,
           certification_verified_by = CASE WHEN $2 THEN $4 ELSE NULL END,
           experience_years = COALESCE($5::int, experience_years),
           availability = CASE
             WHEN $2
              AND COALESCE(operational_status, 'AVAILABLE') = 'AVAILABLE'
              AND EXISTS (
                SELECT 1
                FROM availability_slots slot
                WHERE slot.radiologist_id = radiologists.id
                  AND slot.is_booked = FALSE
                  AND NOW() BETWEEN slot.start_time AND slot.end_time
              )
              AND NOT EXISTS (
                SELECT 1
                FROM leave_requests lr
                WHERE lr.radiologist_id = radiologists.id
                  AND CURRENT_DATE BETWEEN lr.start_date AND lr.end_date
              )
             THEN TRUE
             ELSE FALSE
           END
       WHERE id = $1
       RETURNING
         id,
         radiologist_code,
         name,
         email,
         specialization,
         experience_years,
         certification_number,
         certification_authority,
         certification_verified,
         verification_status,
         certification_verified_at,
         certification_verified_by,
         availability,
         operational_status`,
      [radiologistId, verified, status, verifiedBy, parsedExperienceYears]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ ok: false, error: "Radiologist not found" });
    }

    await sendStatusUpdate({
      radiologist_id: result.rows[0].id,
      radiologist_code: result.rows[0].radiologist_code,
      status: result.rows[0].operational_status || "AVAILABLE",
      reason: verified ? "certification_verified" : "certification_rejected",
      changed_at: new Date().toISOString(),
    });

    res.json({ ok: true, data: result.rows[0] });
  } catch (err) {
    console.error("Radiologist verification error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
