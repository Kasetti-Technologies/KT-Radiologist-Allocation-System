import { Kafka } from "kafkajs";

const kafka = new Kafka({
  clientId: "ras-base-consumer",
  brokers: [process.env.KAFKA_BROKER],
});

export const createConsumer = async (topic, groupId, callback) => {
  const consumer = kafka.consumer({ groupId });
  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning: false });
  console.log(`✅ Subscribed to Kafka topic: ${topic}`);

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const data = JSON.parse(message.value.toString());
        await callback(data);
      } catch (err) {
        console.error("❌ Consumer error:", err);
      }
    },
  });
};
