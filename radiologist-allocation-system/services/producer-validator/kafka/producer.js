// services/producer-validator/kafka/producer.js
import { Kafka } from "kafkajs";

const kafka = new Kafka({
  clientId: "validator-producer",
  brokers: [process.env.KAFKA_BROKER],
});

const producer = kafka.producer();

export const connectProducer = async () => {
  await producer.connect();
  console.log("✅ Validator Dead-Letter Producer connected");
};

export const sendToDeadLetter = async (topic, payload) => {
  try {
    await producer.send({
      topic,
      messages: [{ value: JSON.stringify(payload) }],
    });
    console.log(`📤 Sent invalid message to ${topic}`);
  } catch (err) {
    console.error("🚨 Failed to publish to dead-letter:", err);
  }
};
