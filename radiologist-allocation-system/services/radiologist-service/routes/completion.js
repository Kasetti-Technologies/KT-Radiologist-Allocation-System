// services/radiologist-service/routes/completion.js
import express from "express";
import { sendCompletionEvent } from "../kafka/producer.js";

const router = express.Router();

/**
 * POST /api/complete
 * Body: { case_id: "CASE-MRI-777", radiologist_id: 6 }
 */
router.post("/", async (req, res) => {
  try {
    const { case_id, radiologist_id } = req.body;
    if (!case_id || !radiologist_id) {
      return res.status(400).json({ ok: false, error: "case_id and radiologist_id are required" });
    }

    const payload = {
      case_id,
      radiologist_id,
      completed_at: new Date().toISOString(),
    };

    await sendCompletionEvent(payload);
    res.json({ ok: true, message: `Case ${case_id} marked as completed` });
  } catch (err) {
    console.error("❌ Completion API error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
