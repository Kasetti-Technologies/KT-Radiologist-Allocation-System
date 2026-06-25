import { Kafka } from "kafkajs";
import { allocateRadiologist } from "../logic/allocator.js";
import { pool } from "../db/connect.js";
import { sendAssignedMessage } from "./producer.js";
import { allocationsCounter, slaGauge } from "../index.js";

const kafka = new Kafka({
  clientId: "allocator-service",
  brokers: [process.env.KAFKA_BROKER],
});

const consumer = kafka.consumer({ groupId: "allocator-group" });
const BILLING_WEBHOOK_URLS = [
  process.env.BILLING_WEBHOOK_URL || "http://172.16.16.39:8004/billing/report-completed",
  process.env.BILLING_MIRROR_WEBHOOK_URL || "https://webhook.site/c45f61b7-64d1-4c82-80ea-82aab63ef6a1",
].filter(Boolean);

function safeParse(msg) {
  try {
    return JSON.parse(msg);
  } catch {
    console.warn("Invalid JSON message received, skipping:", msg);
    return null;
  }
}

async function storePendingAssignment(client, data) {
  await client.query(
    `INSERT INTO assignments (
       ticket_id, hospital_id, study_uid, patient_uuid, encounter_uuid, category, priority, sla_minutes, status, bahmni_url, created_at, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING', $9, NOW(), NOW())
     ON CONFLICT (ticket_id) DO UPDATE
     SET hospital_id = EXCLUDED.hospital_id,
         study_uid = COALESCE(EXCLUDED.study_uid, assignments.study_uid),
         patient_uuid = COALESCE(EXCLUDED.patient_uuid, assignments.patient_uuid),
         encounter_uuid = COALESCE(EXCLUDED.encounter_uuid, assignments.encounter_uuid),
         category = EXCLUDED.category,
         priority = EXCLUDED.priority,
         sla_minutes = EXCLUDED.sla_minutes,
         bahmni_url = EXCLUDED.bahmni_url,
         updated_at = NOW()
     WHERE assignments.status = 'PENDING'`,
    [
      data.ticket_id,
      data.hospital_id || data.tenant_id || null,
      data.study_uid || null,
      data.patient_uuid || null,
      data.encounter_uuid || null,
      data.category,
      data.priority || 2,
      data.sla_minutes || 0,
      data.bahmni_url || null
    ]
  );
}

async function assignCase(client, assignmentRow, selected) {
  const result = await client.query(
    `UPDATE assignments
     SET radiologist_id = $2,
         radiologist_code = $3,
         radiologist_name = $4,
         status = 'ASSIGNED',
         assigned_at = NOW(),
         booked_slot_id = $5,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [assignmentRow.id, selected.id, selected.radiologist_code, selected.name, selected.slot_id]
  );

  return result.rows[0];
}

async function tryAssignCase(data) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await storePendingAssignment(client, data);

    const pendingResult = await client.query(
      `SELECT *
       FROM assignments
       WHERE ticket_id = $1
         AND status <> 'COMPLETED'
       FOR UPDATE`,
      [data.ticket_id]
    );

    const assignmentRow = pendingResult.rows[0];
    if (!assignmentRow) {
      await client.query("COMMIT");
      return null;
    }

    const selected = await allocateRadiologist(client, data.category, data.skills_required || []);
    if (!selected) {
      await client.query(
        `UPDATE assignments
         SET status = 'PENDING',
             retry_count = COALESCE(retry_count, 0) + 1,
             last_retry_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [assignmentRow.id]
      );
      await client.query("COMMIT");
      return { assigned: false, assignment: assignmentRow };
    }

    const assignment = await assignCase(client, assignmentRow, selected);
    await client.query("COMMIT");

    allocationsCounter.inc({ radiologist: selected.name, category: data.category });
    slaGauge.set({ category: data.category }, data.sla_minutes || 0);

    await sendAssignedMessage({
      ticket_id: assignment.ticket_id,
      case_id: assignment.ticket_id,
      hospital_id: assignment.hospital_id,
      radiologist_id: selected.id,
      radiologist_code: selected.radiologist_code,
      radiologist_name: selected.name,
      category: assignment.category,
      assigned_at: new Date().toISOString(),
    });

    return { assigned: true, assignment, selected };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function retryPendingAssignments(limit = 20) {
  const pendingRows = await pool.query(
    `SELECT id, ticket_id, hospital_id, category, priority, sla_minutes, bahmni_url
     , study_uid, patient_uuid, encounter_uuid
     FROM assignments
     WHERE status = 'PENDING'
     ORDER BY created_at ASC
     LIMIT $1`,
    [limit]
  );

  for (const row of pendingRows.rows) {
    try {
      const result = await tryAssignCase({
        ticket_id: row.ticket_id,
        hospital_id: row.hospital_id,
        study_uid: row.study_uid,
        patient_uuid: row.patient_uuid,
        encounter_uuid: row.encounter_uuid,
        category: row.category,
        priority: row.priority,
        sla_minutes: row.sla_minutes,
        bahmni_url: row.bahmni_url,
        skills_required: [row.category]
      });

      if (result?.assigned) {
        console.log(`Pending case ${row.ticket_id} assigned to ${result.selected.name}`);
      }
    } catch (err) {
      console.error(`Retry failed for pending case ${row.ticket_id}:`, err);
    }
  }
}

async function handleRadiologistStatusEvent(data) {
  const status = String(data.status || "").trim().toUpperCase();
  const blockingStatuses = new Set(["EMERGENCY_UNAVAILABLE", "OFFLINE", "MANUALLY_BLOCKED", "ON_LEAVE"]);
  const isBlocking = blockingStatuses.has(status);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (isBlocking) {
      await client.query(
        `UPDATE radiologists
         SET availability = FALSE,
             operational_status = $2,
             unavailable_since = COALESCE($3::timestamp, NOW()),
             unavailable_until = $4::timestamp,
             unavailable_reason = $5
         WHERE id = $1`,
        [
          data.radiologist_id,
          status,
          data.unavailable_since || data.changed_at || null,
          data.unavailable_until || null,
          data.reason || null
        ]
      );

      const activeAssignments = await client.query(
        `SELECT id, ticket_id, booked_slot_id, radiologist_id, radiologist_code, status
         FROM assignments
         WHERE radiologist_id = $1
           AND status IN ('ASSIGNED', 'IN_REVIEW', 'BREACHED')
         FOR UPDATE`,
        [data.radiologist_id]
      );

      for (const assignment of activeAssignments.rows) {
        if (assignment.booked_slot_id) {
          await client.query(
            `UPDATE availability_slots
             SET is_booked = FALSE
             WHERE id = $1`,
            [assignment.booked_slot_id]
          );
        }

        await client.query(
          `UPDATE assignments
           SET status = 'PENDING',
               radiologist_id = NULL,
               radiologist_code = NULL,
               radiologist_name = NULL,
               booked_slot_id = NULL,
               previous_radiologist_id = $2,
               previous_radiologist_code = $3,
               reassignment_reason = $4,
               reassigned_at = NOW(),
               retry_count = COALESCE(retry_count, 0) + 1,
               last_retry_at = NOW(),
               updated_at = NOW()
           WHERE id = $1`,
          [
            assignment.id,
            assignment.radiologist_id,
            assignment.radiologist_code,
            `radiologist_${status.toLowerCase()}`
          ]
        );
      }

      if (activeAssignments.rows.length) {
        await client.query(
          `UPDATE radiologists
           SET assigned_count = GREATEST(assigned_count - $2, 0)
           WHERE id = $1`,
          [data.radiologist_id, activeAssignments.rows.length]
        );
      }
    } else if (status === "AVAILABLE") {
      await client.query(
        `UPDATE radiologists r
         SET operational_status = 'AVAILABLE',
             unavailable_since = NULL,
             unavailable_until = NULL,
             unavailable_reason = NULL,
             availability = EXISTS (
               SELECT 1
               FROM availability_slots slot
               WHERE slot.radiologist_id = r.id
                 AND slot.is_booked = FALSE
                 AND NOW() BETWEEN slot.start_time AND slot.end_time
             )
             AND NOT EXISTS (
               SELECT 1
               FROM leave_requests lr
               WHERE lr.radiologist_id = r.id
                 AND CURRENT_DATE BETWEEN lr.start_date AND lr.end_date
             )
             AND NOT EXISTS (
               SELECT 1
               FROM assignments a
               WHERE a.radiologist_id = r.id
                 AND a.status IN ('ASSIGNED', 'IN_REVIEW')
             )
         WHERE r.id = $1`,
        [data.radiologist_id]
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  if (isBlocking || status === "AVAILABLE") {
    await retryPendingAssignments();
  }
}

async function postBillingWebhook(url, payload) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => "");
      console.error(`Billing webhook failed for ${url} with status ${response.status}${responseText ? `: ${responseText}` : ""}`);
    } else {
      console.log(`Billing webhook payload sent successfully to ${url}`);
    }
  } catch (err) {
    console.error(`Billing webhook error for ${url}:`, err);
  }
}

async function sendCompletionBillingPayload(caseId) {
  const result = await pool.query(
    `SELECT
       a.ticket_id,
       a.hospital_id,
       a.study_uid,
       a.patient_uuid,
       a.encounter_uuid,
       a.category,
       a.priority,
       a.sla_minutes,
       a.status,
       a.assigned_at,
       a.completed_at,
       a.bahmni_url,
       r.id AS radiologist_id,
       r.radiologist_code,
       r.name AS radiologist_name,
       r.email AS radiologist_email,
       r.specialization AS radiologist_specialization
     FROM assignments a
     LEFT JOIN radiologists r
       ON r.id = a.radiologist_id
     WHERE a.ticket_id = $1
     LIMIT 1`,
    [caseId]
  );

  const row = result.rows[0];
  if (!row) return;

  const payload = {
    event: "radiology.case.completed",
    sent_at: new Date().toISOString(),
    tenant_id: row.hospital_id,
    hospital_id: row.hospital_id,
    study_id: row.ticket_id,
    study_uid: row.study_uid,
    patient_uuid: row.patient_uuid,
    encounter_uuid: row.encounter_uuid,
    completed_at: row.completed_at,
    case: {
      ticket_id: row.ticket_id,
      hospital_id: row.hospital_id,
      study_id: row.ticket_id,
      study_uid: row.study_uid,
      patient_uuid: row.patient_uuid,
      encounter_uuid: row.encounter_uuid,
      category: row.category,
      priority: row.priority,
      sla_minutes: row.sla_minutes,
      status: row.status,
      assigned_at: row.assigned_at,
      completed_at: row.completed_at,
      bahmni_url: row.bahmni_url,
    },
    radiologist: {
      id: row.radiologist_code || row.radiologist_id,
      internal_id: row.radiologist_id,
      name: row.radiologist_name,
      email: row.radiologist_email,
      specialization: row.radiologist_specialization,
    },
  };

  for (const url of BILLING_WEBHOOK_URLS) {
    await postBillingWebhook(url, payload);
  }
}

export const startConsumer = async () => {
  await consumer.connect();
  console.log("Allocator Consumer connected");

  await consumer.subscribe({ topic: "radiology.validated", fromBeginning: false });
  await consumer.subscribe({ topic: "radiologist.availability", fromBeginning: false });
  await consumer.subscribe({ topic: "radiologist.leave", fromBeginning: false });
  await consumer.subscribe({ topic: "radiologist.status", fromBeginning: false });
  await consumer.subscribe({ topic: "radiology.completed", fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const data = safeParse(message.value.toString());
      if (!data) return;

      console.log(`[${topic}] Received:`, data);

      try {
        if (topic === "radiologist.availability") {
          await pool.query(
            `UPDATE radiologists
             SET availability = CASE
               WHEN COALESCE(operational_status, 'AVAILABLE') = 'AVAILABLE'
                AND EXISTS (
                  SELECT 1
                  FROM availability_slots slot
                  WHERE slot.radiologist_id = radiologists.id
                    AND slot.is_booked = FALSE
                    AND NOW() BETWEEN slot.start_time AND slot.end_time
                )
               THEN TRUE
               ELSE FALSE
             END
             WHERE id = $1`,
            [data.radiologist_id]
          );
          await retryPendingAssignments();
          return;
        }

        if (topic === "radiologist.leave") {
          const leaveIsActive = await pool.query(
            `SELECT CURRENT_DATE BETWEEN $1::date AND $2::date AS active_now`,
            [data.start_date, data.end_date]
          );

          if (leaveIsActive.rows[0]?.active_now) {
            await handleRadiologistStatusEvent({
              radiologist_id: data.radiologist_id,
              status: "ON_LEAVE",
              reason: data.reason || "Leave active",
              changed_at: new Date().toISOString(),
            });
          }
          return;
        }

        if (topic === "radiologist.status") {
          await handleRadiologistStatusEvent(data);
          return;
        }

        if (topic === "radiology.validated") {
          const result = await tryAssignCase(data);
          if (!result?.assigned) {
            console.warn(`No available radiologist for ${data.ticket_id}. Stored as pending.`);
            return;
          }

          console.log(`Case ${data.ticket_id} assigned to ${result.selected.name}`);
          return;
        }

        if (topic === "radiology.completed") {
          const { case_id, radiologist_id, completed_at } = data;

          const completion = await pool.query(
            `UPDATE assignments
             SET status = 'COMPLETED',
                 completed_at = $1,
                 updated_at = NOW()
             WHERE ticket_id = $2
             RETURNING ticket_id, hospital_id, booked_slot_id`,
            [completed_at || new Date().toISOString(), case_id]
          );

          if (completion.rows.length) {
            const bookedSlotId = completion.rows[0].booked_slot_id;

            if (bookedSlotId) {
              await pool.query(
                `UPDATE availability_slots
                 SET is_booked = FALSE
                 WHERE id = $1`,
                [bookedSlotId]
              );
            }

            await pool.query(
              `UPDATE radiologists
               SET assigned_count = GREATEST(assigned_count - 1, 0),
                   availability = CASE
                     WHEN COALESCE(operational_status, 'AVAILABLE') = 'AVAILABLE'
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
                      AND NOT EXISTS (
                        SELECT 1
                        FROM assignments a
                        WHERE a.radiologist_id = radiologists.id
                          AND a.status IN ('ASSIGNED', 'IN_REVIEW')
                          AND a.ticket_id <> $2
                      )
                     THEN TRUE
                     ELSE FALSE
                   END
               WHERE id = $1`,
              [radiologist_id, case_id]
            );

            await sendCompletionBillingPayload(case_id);
          }

          await retryPendingAssignments();
          return;
        }
      } catch (err) {
        console.error("Allocation processing error:", err);
      }
    },
  });
};
