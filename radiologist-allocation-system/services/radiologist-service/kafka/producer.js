// services/radiologist-service/kafka/producer.js
import { Kafka } from "kafkajs";
import dotenv from "dotenv";
dotenv.config();

const kafka = new Kafka({
  clientId: "radiologist-service",
  brokers: [process.env.KAFKA_BROKER],
});

const producer = kafka.producer();

export const sendAvailabilityUpdate = async (message) => {
  await producer.connect();
  await producer.send({
    topic: process.env.KAFKA_TOPIC_AVAILABILITY,
    messages: [{ value: JSON.stringify(message) }],
  });
  console.log("📤 Sent availability update:", message);
  await producer.disconnect();
};

// ✅ NEW: send “case completed” event
export const sendCompletionEvent = async (message) => {
  await producer.connect();
  await producer.send({
    topic: "radiology.completed",
    messages: [{ value: JSON.stringify(message) }],
  });
  console.log("📤 Sent case completion event:", message);
  await producer.disconnect();
};
