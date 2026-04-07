import { Kafka } from "kafkajs";
import dotenv from "dotenv";
dotenv.config();

const kafka = new Kafka({
  clientId: "radiologist-service",
  brokers: [process.env.KAFKA_BROKER],
});

const producer = kafka.producer();
let connected = false;

async function ensureConnected() {
  if (!connected) {
    await producer.connect();
    connected = true;
  }
}

async function publish(topic, message) {
  await ensureConnected();
  await producer.send({
    topic,
    messages: [{ value: JSON.stringify(message) }],
  });
}

export const sendAvailabilityUpdate = async (message) => {
  await publish(process.env.KAFKA_TOPIC_AVAILABILITY, message);
  console.log("Sent availability update:", message);
};

export const sendLeaveUpdate = async (message) => {
  await publish(process.env.KAFKA_TOPIC_LEAVE, message);
  console.log("Sent leave update:", message);
};

export const sendCompletionEvent = async (message) => {
  await publish("radiology.completed", message);
  console.log("Sent case completion event:", message);
};
