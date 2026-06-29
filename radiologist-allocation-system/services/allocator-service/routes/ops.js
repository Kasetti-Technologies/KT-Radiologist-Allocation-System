import express from "express";
import { pool } from "../db/connect.js";

const router = express.Router();

function requireOpsKey(req, res, next) {
  const expectedKey = process.env.OPS_API_KEY;
  if (expectedKey && req.headers["x-ops-key"] !== expectedKey) {
    return res.status(403).json({ ok: false, error: "Invalid operations key" });
  }

  next();
}

router.use(requireOpsKey);

router.get("/summary", async (req, res) => {
  try {
    const cases = await pool.query(
      `SELECT status, COUNT(*)::int AS count
       FROM assignments
       GROUP BY status
       ORDER BY status`
    );

    const webhooks = await pool.query(
      `SELECT status, COUNT(*)::int AS count
       FROM billing_webhook_failures
       GROUP BY status
       ORDER BY status`
    );

    res.json({ ok: true, data: { cases: cases.rows, billing_webhooks: webhooks.rows } });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/cases", async (req, res) => {
  try {
    const statuses = String(req.query.status || "PENDING,ESCALATED,BREACHED")
      .split(",")
      .map((status) => status.trim().toUpperCase())
      .filter(Boolean);

    const result = await pool.query(
      `SELECT
         id,
         ticket_id,
         hospital_id,
         study_uid,
         category,
         priority,
         status,
         sla_minutes,
         assigned_at,
         completed_at,
         radiologist_id,
         radiologist_code,
         radiologist_name,
         retry_count,
         last_retry_at,
         reassignment_reason,
         escalated,
         updated_at,
         created_at
       FROM assignments
       WHERE status = ANY($1::text[])
       ORDER BY
         CASE status
           WHEN 'BREACHED' THEN 1
           WHEN 'ESCALATED' THEN 2
           WHEN 'PENDING' THEN 3
           ELSE 4
         END,
         created_at ASC
       LIMIT 500`,
      [statuses]
    );

    res.json({ ok: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get("/billing-webhooks", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, url, status, http_status, response_body, error_message, attempts, next_retry_at, last_attempt_at, delivered_at, created_at, updated_at
       FROM billing_webhook_failures
       ORDER BY created_at DESC
       LIMIT 200`
    );

    res.json({ ok: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/billing-webhooks/:id/retry", async (req, res) => {
  try {
    const existing = await pool.query(
      `SELECT *
       FROM billing_webhook_failures
       WHERE id = $1
       LIMIT 1`,
      [req.params.id]
    );

    const row = existing.rows[0];
    if (!row) {
      return res.status(404).json({ ok: false, error: "Webhook failure not found" });
    }

    const response = await fetch(row.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row.payload),
    });

    const responseText = await response.text().catch(() => "");
    const status = response.ok ? "DELIVERED" : "FAILED";

    const updated = await pool.query(
      `UPDATE billing_webhook_failures
       SET status = $2,
           http_status = $3,
           response_body = $4,
           error_message = NULL,
           attempts = attempts + 1,
           last_attempt_at = NOW(),
           next_retry_at = CASE WHEN $2 = 'DELIVERED' THEN NULL ELSE NOW() + INTERVAL '5 minutes' END,
           delivered_at = CASE WHEN $2 = 'DELIVERED' THEN NOW() ELSE delivered_at END,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, url, status, http_status, response_body, attempts, delivered_at, updated_at`,
      [row.id, status, response.status, responseText]
    );

    res.json({ ok: response.ok, data: updated.rows[0], error: response.ok ? null : responseText || "Retry failed" });
  } catch (err) {
    await pool.query(
      `UPDATE billing_webhook_failures
       SET status = 'FAILED',
           error_message = $2,
           attempts = attempts + 1,
           last_attempt_at = NOW(),
           next_retry_at = NOW() + INTERVAL '5 minutes',
           updated_at = NOW()
       WHERE id = $1`,
      [req.params.id, err.message]
    );
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
