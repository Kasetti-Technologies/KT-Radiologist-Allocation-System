// services/allocator-service/slaMonitor.js
import { pool } from "./db/connect.js";
import { reassignTicket } from "./logic/reassign.js";
import { slaBreachesCounter } from "./index.js";

const CHECK_INTERVAL_MS = parseInt(process.env.SLA_CHECK_INTERVAL_MS || "30000", 10); // 30s default

export const startSlaMonitor = () => {
  console.log(`🕵️ SLA Monitor started (interval ${CHECK_INTERVAL_MS / 1000}s)`);

  const checkOnce = async () => {
    try {
      const q = `
        SELECT *
        FROM assignments
        WHERE status = 'PENDING'
          AND (assigned_at + (sla_minutes || ' minutes')::interval) < NOW()
          AND escalated = false;
      `;
      const res = await pool.query(q);
      if (res.rows.length === 0) return;

      for (const assignment of res.rows) {
        console.warn(`⚠️ SLA breach detected for ticket ${assignment.ticket_id} (id=${assignment.id})`);
        slaBreachesCounter.inc();

        // Mark as breached to avoid double handling
        await pool.query(`UPDATE assignments SET status = 'BREACHED' WHERE id = $1`, [assignment.id]);

        // Attempt auto-reassignment
        const outcome = await reassignTicket(assignment);

        if (!outcome.success) {
          console.error(`❌ Reassignment failed for ${assignment.ticket_id}:`, outcome.reason || outcome.err);
          await pool.query(`UPDATE assignments SET escalated = true WHERE id = $1`, [assignment.id]);
        } else {
          console.log(`🔁 Ticket ${assignment.ticket_id} successfully auto-reassigned to ${outcome.newRadiologist}`);
        }
      }
    } catch (err) {
      console.error("❌ SLA Monitor error:", err);
    }
  };

  // run immediately + every interval
  checkOnce();
  const intervalId = setInterval(checkOnce, CHECK_INTERVAL_MS);
  return () => clearInterval(intervalId);
};
