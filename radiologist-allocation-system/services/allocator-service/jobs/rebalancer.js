import { pool } from "../db/connect.js";

async function rebalanceAvailability() {
  try {
    console.log("Rebalancer running...");

    await pool.query(`
      UPDATE radiologists r
      SET availability = CASE
        WHEN EXISTS (
          SELECT 1
          FROM leave_requests lr
          WHERE lr.radiologist_id = r.id
            AND CURRENT_DATE BETWEEN lr.start_date AND lr.end_date
        ) THEN FALSE
        WHEN EXISTS (
          SELECT 1
          FROM assignments a
          WHERE a.radiologist_id = r.id
            AND a.status IN ('ASSIGNED', 'IN_REVIEW')
        ) THEN FALSE
        WHEN EXISTS (
          SELECT 1
          FROM availability_slots slot
          WHERE slot.radiologist_id = r.id
            AND slot.is_booked = FALSE
            AND NOW() BETWEEN slot.start_time AND slot.end_time
        ) THEN TRUE
        ELSE FALSE
      END
    `);

    console.log("Rebalancer synced availability with active slots, leave, and case status.");
  } catch (err) {
    console.error("Rebalancer error:", err);
  }
}

/**
 * Periodically sync radiologist availability with the current scheduling rules.
 */
export const startRebalancer = () => {
  rebalanceAvailability();
  setInterval(rebalanceAvailability, 2 * 60 * 1000);
};
