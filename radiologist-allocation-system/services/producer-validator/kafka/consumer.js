import { Kafka } from "kafkajs";
import dotenv from "dotenv";
dotenv.config();

const kafka = new Kafka({
  clientId: "producer-validator",
  brokers: [process.env.KAFKA_BROKER],
});

const consumer = kafka.consumer({ groupId: process.env.KAFKA_GROUP_ID });

export const connectConsumer = async () => {
  await consumer.connect();
  console.log(`✅ Kafka Consumer connected to ${process.env.KAFKA_BROKER}`);

  await consumer.subscribe({ topic: process.env.KAFKA_TOPIC, fromBeginning: true });
  console.log(`📡 Subscribed to topic: ${process.env.KAFKA_TOPIC}`);

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      console.log(`📥 Received message from ${topic}:`);
      console.log(message.value.toString());

      // Future: validate or transform data here
    },
  });
};
