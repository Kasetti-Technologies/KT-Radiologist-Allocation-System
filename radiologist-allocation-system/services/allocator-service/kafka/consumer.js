// services/allocator-service/kafka/consumer.js
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

function safeParse(msg) {
  try {
    return JSON.parse(msg);
  } catch {
    console.warn("⚠️ Invalid JSON message received, skipping:", msg);
    return null;
  }
}

export const startConsumer = async () => {
  await consumer.connect();
  console.log(`✅ Allocator Consumer connected`);

  await consumer.subscribe({ topic: "radiology.validated", fromBeginning: true });
  await consumer.subscribe({ topic: "radiologist.availability", fromBeginning: false });
  await consumer.subscribe({ topic: "radiologist.leave", fromBeginning: false });
  await consumer.subscribe({ topic: "radiology.completed", fromBeginning: false }); // ✅ new topic

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const data = safeParse(message.value.toString());
      if (!data) return;

      console.log(`📥 [${topic}] Received:`, data);

      try {
        // ✅ Radiologist available
        if (topic === "radiologist.availability") {
          console.log("✅ Availability event recorded:", data);
          return;
        }

        // 🚫 Radiologist on leave
        if (topic === "radiologist.leave") {
          await pool.query(
            "UPDATE radiologists SET availability = false WHERE id = $1",
            [data.radiologist_id]
          );
          console.log(`🚫 Radiologist ${data.radiologist_id} on leave`);
          return;
        }

        // 🩻 New validated radiology case
        if (topic === "radiology.validated") {
          const { ticket_id, category, priority, skills_required, sla_minutes } = data;
          const selected = await allocateRadiologist(category, skills_required);

          if (!selected) {
            console.warn(`⚠️ No available radiologist for ${ticket_id}`);
            return;
          }

            await pool.query(
            `INSERT INTO assignments 
            (ticket_id, radiologist_id, radiologist_name, category, priority, sla_minutes, status, bahmni_url, assigned_at)
            VALUES ($1, $2, $3, $4, $5, $6, 'ASSIGNED', $7, NOW())`,
            [
            ticket_id,
            selected.id,
            selected.name,
            category,
            priority || 2,
            sla_minutes || 0,
            data.bahmni_url || null
            ]
              );

          allocationsCounter.inc({ radiologist: selected.name, category });
          slaGauge.set({ category }, sla_minutes || 0);

          await sendAssignedMessage({
            case_id: ticket_id,
            radiologist_id: selected.id,
            radiologist_name: selected.name,
            category,
            assigned_at: new Date().toISOString(),
          });

          console.log(`✅ Case ${ticket_id} assigned to ${selected.name}`);
          return;
        }

        // 🏁 Case completed by radiologist
        if (topic === "radiology.completed") {
          const { case_id, radiologist_id, completed_at } = data;
          console.log(`🏁 Completion event received for case ${case_id} by radiologist ${radiologist_id}`);

          // Mark assignment as completed
          await pool.query(
            `UPDATE assignments
             SET status = 'COMPLETED',
                 completed_at = $1
             WHERE ticket_id = $2`,
            [completed_at || new Date().toISOString(), case_id]
          );

          // Free the radiologist slot
          await pool.query(
            `UPDATE radiologists
             SET assigned_count = GREATEST(assigned_count - 1, 0),
                 availability = TRUE
             WHERE id = $1`,
            [radiologist_id]
          );

          console.log(`✅ Case ${case_id} marked as COMPLETED and radiologist ${radiologist_id} freed`);
          return;
        }
      } catch (err) {
        console.error("❌ Allocation processing error:", err);
      }
    },
  });
};
