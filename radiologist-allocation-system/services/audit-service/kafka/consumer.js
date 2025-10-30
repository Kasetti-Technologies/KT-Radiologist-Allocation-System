// services/audit-service/kafka/consumer.js
import { Kafka } from "kafkajs";
import { pool } from "../db/connect.js";
import { auditEventCounter, radiologistActivityGauge } from "../metrics/prometheus.js";

const kafka = new Kafka({
  clientId: "audit-service",
  brokers: [process.env.KAFKA_BROKER],
});

const consumer = kafka.consumer({ groupId: "audit-group" });

export const startConsumer = async () => {
  await consumer.connect();
  console.log(`📡 Listening to topic: ${process.env.KAFKA_TOPIC}`);
  await consumer.subscribe({ topic: process.env.KAFKA_TOPIC, fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const event = JSON.parse(message.value.toString());
        const { ticket_id, radiologist_id, radiologist_name, category, provenance } = event;

        // DB Insert
        await pool.query(
          `INSERT INTO audit_logs (ticket_id, radiologist_id, radiologist_name, category, action, raw_event)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            ticket_id,
            radiologist_id,
            radiologist_name || "Unknown",
            category,
            provenance?.reason || "assignment_recorded",
            event,
          ]
        );

        // Prometheus metrics update
        auditEventCounter.inc({
          action: provenance?.reason || "assignment_recorded",
          radiologist: radiologist_name || "Unknown",
          category: category || "Unknown",
        });

        radiologistActivityGauge.inc({
          radiologist: radiologist_name || "Unknown",
          category: category || "Unknown",
        });

        console.log(`🧾 Audit logged for ticket ${ticket_id}`);
      } catch (err) {
        console.error("❌ Audit logging failed:", err.message);
      }
    },
  });
};
