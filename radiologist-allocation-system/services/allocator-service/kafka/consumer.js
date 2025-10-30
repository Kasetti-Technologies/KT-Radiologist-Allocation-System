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

export const startConsumer = async () => {
  await consumer.connect();
  console.log(`✅ Allocator Consumer connected to ${process.env.KAFKA_BROKER}`);

  await consumer.subscribe({ topic: "radiology.validated", fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ message }) => {
      const event = JSON.parse(message.value.toString());
      console.log("📥 Received validated event:", event);

      const { ticket_id, category, priority, skills_required, sla_minutes } = event;

      try {
        const selectedRadiologist = await allocateRadiologist(category, skills_required);

        let radiologistId = null;
        let radiologistName = null;
        let actionReason = "auto_assignment_success";

        if (selectedRadiologist) {
          radiologistId = selectedRadiologist.id;
          radiologistName = selectedRadiologist.name;

          // ✅ Insert into assignments
          const result = await pool.query(
            `INSERT INTO assignments (ticket_id, radiologist_id, radiologist_name, assigned_at, priority)
             VALUES ($1, $2, $3, NOW(), $4)
             RETURNING *`,
            [ticket_id, radiologistId, radiologistName, priority]
          );
          console.log("✅ Assignment created:", result.rows[0]);

          // ✅ Update Prometheus metrics
          allocationsCounter.inc({ radiologist: radiologistName, category });
          slaGauge.set({ category }, sla_minutes || 0);
        } else {
          console.warn(`⚠️ No radiologist found for ${ticket_id}`);
          actionReason = "no_alternative";
        }

        // ✅ Always send an audit message (success or failure)
        await sendAssignedMessage({
          ticket_id,
          radiologist_id: radiologistId,
          radiologist_name: radiologistName,
          category,
          assigned_at: new Date().toISOString(),
          provenance: {
            service: "allocator-service",
            reason: actionReason,
          },
        });

        console.log(`📤 Sent audit message (${actionReason}) for ticket ${ticket_id}`);
      } catch (err) {
        console.error("❌ Allocation processing error:", err);
      }
    },
  });
};
