// services/allocator-service/logic/reassign.js
import { pool } from "../db/connect.js";
import { allocateRadiologist } from "./allocator.js";
import { sendAssignedMessage } from "../kafka/producer.js";
import { reassignmentsCounter } from "../index.js"; // exported from index.js

export const reassignTicket = async (assignment) => {
  const { id, ticket_id, radiologist_id: oldId, category } = assignment;
  try {
    // Try to find alternative radiologist (exclude current)
    const selected = await allocateRadiologist(category, [], [oldId]);
    if (!selected) {
      // No alternative — mark escalated
      await pool.query(`UPDATE assignments SET escalated = true WHERE id = $1`, [id]);
      return { success: false, reason: "no_alternative" };
    }

    // Update assignment with new radiologist
    const res = await pool.query(
      `UPDATE assignments
         SET radiologist_id = $1,
             radiologist_name = $2,
             assigned_at = NOW(),
             status = 'PENDING',
             escalated = false
       WHERE id = $3
       RETURNING *`,
      [selected.id, selected.name, id]
    );

    // Audit
    await pool.query(
      `INSERT INTO allocation_audit (ticket_id, radiologist_id, action, created_at)
       VALUES ($1, $2, 'REASSIGNED', NOW())`,
      [ticket_id, selected.id]
    );

    // Emit metric & downstream event
    reassignmentsCounter.inc();
    await sendAssignedMessage({
      ticket_id,
      radiologist_id: selected.id,
      radiologist_name: selected.name,
      category,
      assigned_at: new Date().toISOString(),
      provenance: {
        service: "allocator-service",
        reason: "auto_reassignment",
      },
    });

    return { success: true, new: res.rows[0] };
  } catch (err) {
    console.error("❌ reassignTicket error:", err);
    return { success: false, reason: "exception", err: err.message };
  }
};
