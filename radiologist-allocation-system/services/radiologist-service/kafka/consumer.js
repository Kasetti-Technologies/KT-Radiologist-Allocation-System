import { Kafka } from "kafkajs";
import dotenv from "dotenv";

dotenv.config();

const kafka = new Kafka({
  clientId: "ras-radiologist-consumer",
  brokers: [process.env.KAFKA_BROKER],
});

const consumer = kafka.consumer({ groupId: process.env.KAFKA_GROUP_ID });

export const startConsumer = async () => {
  await consumer.connect();
  console.log("Kafka Consumer connected");

  await consumer.subscribe({ topic: process.env.KAFKA_TOPIC_ALLOCATED, fromBeginning: false });
  console.log(`Subscribed to topic: ${process.env.KAFKA_TOPIC_ALLOCATED}`);

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const event = JSON.parse(message.value.toString());
        console.log("Received allocation event:", event);
        console.log(`Case ${event.case_id} is assigned to radiologist ${event.radiologist_name}`);
      } catch (error) {
        console.error("Error processing message:", error);
      }
    },
  });
};
