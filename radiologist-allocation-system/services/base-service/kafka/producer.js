import { Kafka } from "kafkajs";

const kafka = new Kafka({
  clientId: "ras-base-producer",
  brokers: [process.env.KAFKA_BROKER],
});

const producer = kafka.producer();

export const connectProducer = async () => {
  await producer.connect();
  console.log("✅ Kafka Producer connected");
};

export const sendMessage = async (topic, message) => {
  await producer.send({
    topic,
    messages: [{ value: JSON.stringify(message) }],
  });
  console.log(`📤 Message sent to ${topic}`);
};
