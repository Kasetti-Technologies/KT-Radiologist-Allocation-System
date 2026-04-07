import { pool } from "../db/connect.js";
import { allocateRadiologist } from "./allocator.js";
import { reassignmentsCounter } from "../index.js";
import { sendAssignedMessage } from "../kafka/producer.js";

export const reassignTicket = async (assignment) => {
  const client = await pool.connect();

  try {
    console.log(`Attempting reassignment for ticket ${assignment.ticket_id}`);
    await client.query("BEGIN");

    const lockedAssignment = await client.query(
      `SELECT *
       FROM assignments
       WHERE id = $1
       FOR UPDATE`,
      [assignment.id]
    );

    const current = lockedAssignment.rows[0];
    if (!current) {
      await client.query("ROLLBACK");
      return { success: false, reason: "Assignment not found" };
    }

    const previousRadiologistId = current.radiologist_id;
    const previousBookedSlotId = current.booked_slot_id;

    if (previousRadiologistId) {
      await client.query(
        `UPDATE radiologists
         SET assigned_count = GREATEST(assigned_count - 1, 0),
             availability = TRUE
         WHERE id = $1`,
        [previousRadiologistId]
      );
    }

    if (previousBookedSlotId) {
      await client.query(
        `UPDATE availability_slots
         SET is_booked = FALSE
         WHERE id = $1`,
        [previousBookedSlotId]
      );
    }

    const newRadiologist = await allocateRadiologist(
      client,
      current.category,
      [current.category],
      previousRadiologistId ? [previousRadiologistId] : []
    );

    if (!newRadiologist) {
      if (previousRadiologistId) {
        await client.query(
          `UPDATE radiologists
           SET assigned_count = assigned_count + 1,
               availability = FALSE
           WHERE id = $1`,
          [previousRadiologistId]
        );
      }

      if (previousBookedSlotId) {
        await client.query(
          `UPDATE availability_slots
           SET is_booked = TRUE
           WHERE id = $1`,
          [previousBookedSlotId]
        );
      }

      await client.query(
        `UPDATE assignments
         SET status = 'ESCALATED',
             escalated = TRUE,
             updated_at = NOW()
         WHERE id = $1`,
        [current.id]
      );

      await client.query("COMMIT");
      return { success: false, reason: "No available radiologist for reassignment" };
    }

    const result = await client.query(
      `UPDATE assignments
       SET radiologist_id = $1,
           radiologist_name = $2,
           booked_slot_id = $3,
           status = 'ASSIGNED',
           escalated = FALSE,
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [newRadiologist.id, newRadiologist.name, newRadiologist.slot_id, current.id]
    );

    await client.query("COMMIT");

    const updated = result.rows[0];
    if (!updated) return { success: false, reason: "Assignment update failed" };

    await sendAssignedMessage({
      ticket_id: updated.ticket_id,
      case_id: updated.ticket_id,
      radiologist_id: newRadiologist.id,
      radiologist_name: newRadiologist.name,
      category: updated.category,
      provenance: {
        reason: "sla_breach_reassigned",
      },
      reassigned_at: new Date().toISOString(),
    });

    reassignmentsCounter.inc();

    console.log(`Ticket ${updated.ticket_id} reassigned to ${newRadiologist.name}`);
    return { success: true, newRadiologist: newRadiologist.name };
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error during reassignment:", err);
    return { success: false, err: err.message };
  } finally {
    client.release();
  }
};
