// services/allocator-service/jobs/rebalancer.js
import { pool } from "../db/connect.js";

/**
 * Periodically checks workload and updates radiologist availability.
 * Runs every 2 minutes.
 */
export const startRebalancer = () => {
  setInterval(async () => {
    try {
      console.log("♻️ Rebalancer running...");

      const query = `
        UPDATE radiologists r
        SET availability = TRUE
        WHERE (
          SELECT COUNT(*) FROM assignments a
          WHERE a.radiologist_id = r.id AND a.status = 'PENDING'
        ) < 5;
      `;
      await pool.query(query);
      console.log("✅ Rebalancer updated availability based on active workload.");
    } catch (err) {
      console.error("❌ Rebalancer error:", err);
    }
  }, 2 * 60 * 1000); // every 2 minutes
};
