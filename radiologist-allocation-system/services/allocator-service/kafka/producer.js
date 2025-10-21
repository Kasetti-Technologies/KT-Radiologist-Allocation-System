// services/allocator-service/kafka/producer.js
import { Kafka } from "kafkajs";

const kafka = new Kafka({
  clientId: "allocator-producer",
  brokers: [process.env.KAFKA_BROKER],
});

const producer = kafka.producer();

export const connectProducer = async () => {
  await producer.connect();
  console.log("✅ Allocator Kafka Producer connected");
};

export const sendAssignedMessage = async (message) => {
  try {
    await producer.send({
      topic: "radiology.assigned",
      messages: [{ value: JSON.stringify(message) }],
    });
    console.log("📤 Sent assigned message:", message);
  } catch (err) {
    console.error("🚨 Failed to send assigned message:", err);
  }
};
