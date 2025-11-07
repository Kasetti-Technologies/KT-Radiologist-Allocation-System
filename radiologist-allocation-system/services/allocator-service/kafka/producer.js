// services/allocator-service/kafka/producer.js
import { Kafka } from "kafkajs";

const kafka = new Kafka({
  clientId: "allocator-producer",
  brokers: [process.env.KAFKA_BROKER],
});

export const producer = kafka.producer();

export const connectProducer = async () => {
  await producer.connect();
  console.log("✅ Allocator Kafka Producer connected");
};

// Send audit/assignment events to "radiology.allocated"
export const sendAssignedMessage = async (payload) => {
  try {
    await producer.send({
      topic: "radiology.allocated",
      messages: [{ value: JSON.stringify(payload) }],
    });
    console.log(`📤 Sent assigned message for ticket ${payload.case_id || payload.ticket_id}`);
  } catch (err) {
    console.error("🚨 Failed to send assigned message:", err);
  }
};
