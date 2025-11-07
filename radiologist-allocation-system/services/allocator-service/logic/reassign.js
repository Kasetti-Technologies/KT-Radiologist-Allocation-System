// services/allocator-service/logic/reassign.js
import { pool } from "../db/connect.js";
import { allocateRadiologist } from "./allocator.js";
import { reassignmentsCounter } from "../index.js";
import { sendAssignedMessage } from "../kafka/producer.js";

export const reassignTicket = async (assignment) => {
  try {
    console.log(`🔄 Attempting reassignment for ticket ${assignment.ticket_id}`);

    // Pick a new radiologist — exclude current one
    const newRadiologist = await allocateRadiologist(
      assignment.category,
      [],
      [assignment.radiologist_id]
    );

    if (!newRadiologist) {
      return { success: false, reason: "No available radiologist for reassignment" };
    }

    // Update assignments table with new radiologist
    const result = await pool.query(
      `UPDATE assignments
         SET radiologist_id = $1,
             radiologist_name = $2,
             reassigned_at = NOW(),
             status = 'REASSIGNED'
       WHERE id = $3
       RETURNING *`,
      [newRadiologist.id, newRadiologist.name, assignment.id]
    );

    const updated = result.rows[0];
    if (!updated) return { success: false, reason: "Assignment update failed" };

    // Emit Kafka audit event
    await sendAssignedMessage({
      case_id: assignment.ticket_id,
      radiologist_id: newRadiologist.id,
      radiologist_name: newRadiologist.name,
      category: assignment.category,
      reassigned_at: new Date().toISOString(),
      reason: "SLA breach auto-reassignment",
    });

    // Increment Prometheus counter
    reassignmentsCounter.inc();

    console.log(`✅ Ticket ${assignment.ticket_id} reassigned to ${newRadiologist.name}`);
    return { success: true, newRadiologist: newRadiologist.name };
  } catch (err) {
    console.error("❌ Error during reassignment:", err);
    return { success: false, err: err.message };
  }
};
