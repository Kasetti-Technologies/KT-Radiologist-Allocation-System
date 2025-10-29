// services/allocator-service/slaMonitor.js
import { pool } from "./db/connect.js";
import { reassignTicket } from "./logic/reassign.js";
import { slaBreachesCounter } from "./index.js"; // import counters from index.js

const CHECK_INTERVAL_MS = process.env.SLA_CHECK_INTERVAL_MS ? parseInt(process.env.SLA_CHECK_INTERVAL_MS) : 30 * 1000; // 30s default

export const startSlaMonitor = () => {
  console.log(`🕵️ SLA Monitor started (interval ${CHECK_INTERVAL_MS}ms)`);

  const checkOnce = async () => {
    try {
      const q = `
        SELECT *
        FROM assignments
        WHERE status = 'PENDING'
          AND (created_at + (sla_minutes || ' minutes')::interval) < NOW()
          AND escalated = false
      `;
      const res = await pool.query(q);
      if (res.rows.length === 0) return;

      for (const assignment of res.rows) {
        console.warn(`⚠️ SLA breach detected for ticket ${assignment.ticket_id} (id=${assignment.id})`);
        slaBreachesCounter.inc();

        // mark as BREACHED to avoid duplicate handling
        await pool.query(`UPDATE assignments SET status = 'BREACHED' WHERE id = $1`, [assignment.id]);

        // attempt re-assignment
        const outcome = await reassignTicket(assignment);
        if (!outcome.success) {
          console.error(`❌ Reassignment failed for ticket ${assignment.ticket_id}:`, outcome.reason || outcome.err);
          await pool.query(`UPDATE assignments SET escalated = true WHERE id = $1`, [assignment.id]);
        } else {
          console.log(`🔁 Ticket ${assignment.ticket_id} auto-reassigned`);
        }
      }
    } catch (err) {
      console.error("❌ SLA Monitor error:", err);
    }
  };

  // initial run + interval
  checkOnce();
  const id = setInterval(checkOnce, CHECK_INTERVAL_MS);
  return () => clearInterval(id);
};
