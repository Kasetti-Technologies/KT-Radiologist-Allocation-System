import { Kafka } from "kafkajs";
import dotenv from "dotenv";
import { pool } from "../db/connect.js";
import { sendKafkaMessage } from "./producer.js";

dotenv.config();

const kafka = new Kafka({
  clientId: "ras-radiologist-consumer",
  brokers: [process.env.KAFKA_BROKER],
});

const consumer = kafka.consumer({ groupId: process.env.KAFKA_GROUP_ID });

export const startConsumer = async () => {
  await consumer.connect();
  console.log("✅ Kafka Consumer connected");

  await consumer.subscribe({ topic: process.env.KAFKA_TOPIC_ALLOCATED, fromBeginning: false });
  console.log(`📡 Subscribed to topic: ${process.env.KAFKA_TOPIC_ALLOCATED}`);

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const event = JSON.parse(message.value.toString());
        console.log("📥 Received allocation event:", event);

        // Simulate radiologist assignment completion after a delay
        setTimeout(async () => {
          // Mark slot as free again
          await pool.query(
            "UPDATE availability_slots SET is_booked = false WHERE radiologist_id = $1",
            [event.radiologist_id]
          );

          console.log(`🩺 Radiologist ${event.radiologist_name} completed case ${event.case_id}`);

          // Emit completion event
          await sendKafkaMessage(process.env.KAFKA_TOPIC_COMPLETED, {
            case_id: event.case_id,
            radiologist_id: event.radiologist_id,
            status: "completed",
            completed_at: new Date().toISOString(),
          });
        }, 15000); // 15 seconds simulation
      } catch (error) {
        console.error("❌ Error processing message:", error);
      }
    },
  });
};
