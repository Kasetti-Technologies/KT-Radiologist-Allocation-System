// services/producer-validator/kafka/consumer.js
import { Kafka } from "kafkajs";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import fs from "fs";
import path from "path";
import { connectProducer, sendToDeadLetter } from "./producer.js";

const kafka = new Kafka({
  clientId: "producer-validator",
  brokers: [process.env.KAFKA_BROKER],
});

const consumer = kafka.consumer({ groupId: "validator-group" });

// AJV setup
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

// Load schema
const schemaDir = path.resolve("/app/schemas");
const ticketSchemaPath = path.join(schemaDir, "radiology.ticket.v1.json");
const ticketSchema = JSON.parse(fs.readFileSync(ticketSchemaPath, "utf-8"));
const validate = ajv.compile(ticketSchema);

export const startConsumer = async () => {
  try {
    await connectProducer(); // connect the dead-letter producer
    await consumer.connect();
    console.log(`✅ Validator Kafka Consumer connected to ${process.env.KAFKA_BROKER}`);

    await consumer.subscribe({ topic: "radiology-events", fromBeginning: true });
    console.log("📡 Subscribed to topic: radiology-events");

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const msgValue = message.value.toString();
        const data = JSON.parse(msgValue);
        console.log("📥 Received message:", data);

        try {
          const valid = validate(data);
          if (!valid) {
            console.error("❌ Validation errors:", validate.errors);

            const deadLetterPayload = {
              original_topic: topic,
              original_message: data,
              validation_errors: validate.errors,
              received_at: new Date().toISOString(),
              provenance: {
                service: "validator-service",
                reason: "schema_validation_failed",
              },
            };

            await sendToDeadLetter("radiology-dead-letter", deadLetterPayload);
            return;
          }

          console.log("✅ Message passed schema validation!");
          // Future: forward to next topic (e.g. radiology.validated)
        } catch (err) {
          console.error("🚨 Processing error:", err);

          await sendToDeadLetter("radiology-dead-letter", {
            original_topic: topic,
            original_message: data,
            error: err.message,
            received_at: new Date().toISOString(),
            provenance: {
              service: "validator-service",
              reason: "processing_exception",
            },
          });
        }
      },
    });
  } catch (err) {
    console.error("❌ Failed to start Validator Consumer:", err);
    process.exit(1);
  }
};
