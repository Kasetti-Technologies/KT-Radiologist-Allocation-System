import { Kafka } from "kafkajs";

const kafka = new Kafka({
  clientId: "allocator-producer",
  brokers: [process.env.KAFKA_BROKER],
});

export const producer = kafka.producer();

export const connectProducer = async () => {
  await producer.connect();
  console.log("Allocator Kafka Producer connected");
};

export const sendAssignedMessage = async (payload) => {
  try {
    const normalizedPayload = {
      ...payload,
      ticket_id: payload.ticket_id || payload.case_id || null,
    };

    await producer.send({
      topic: "radiology.allocated",
      messages: [{ value: JSON.stringify(normalizedPayload) }],
    });
    console.log(`Sent assigned message for ticket ${normalizedPayload.ticket_id}`);
  } catch (err) {
    console.error("Failed to send assigned message:", err);
  }
};
