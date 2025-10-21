// services/allocator-service/kafka/consumer.js
import { Kafka } from "kafkajs";
import { allocateRadiologist } from "../logic/allocator.js";
import { pool } from "../db/connect.js";
import { sendAssignedMessage } from "./producer.js";

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

      const { ticket_id, category, priority, skills_required } = event;

      try {
        const selectedRadiologist = await allocateRadiologist(category, skills_required);
        if (!selectedRadiologist) {
          console.warn(`⚠️ No radiologist found for ${ticket_id}`);
          return;
        }

        // Insert assignment
        const result = await pool.query(
          `INSERT INTO assignments (ticket_id, radiologist_id, assigned_at, priority)
           VALUES ($1, $2, NOW(), $3)
           RETURNING *`,
          [ticket_id, selectedRadiologist.id, priority]
        );
        console.log("✅ Assignment created:", result.rows[0]);

        // Log audit
        await pool.query(
          `INSERT INTO allocation_audit (ticket_id, radiologist_id, action, created_at)
           VALUES ($1, $2, 'ASSIGNED', NOW())`,
          [ticket_id, selectedRadiologist.id]
        );

        // Send downstream message
        await sendAssignedMessage({
          ticket_id,
          radiologist_id: selectedRadiologist.id,
          radiologist_name: selectedRadiologist.name,
          category,
          assigned_at: new Date().toISOString(),
          provenance: {
            service: "allocator-service",
            reason: "auto_assignment_success",
          },
        });
      } catch (err) {
        console.error("❌ Allocation processing error:", err);
      }
    },
  });
};
