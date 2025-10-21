// services/producer-validator/kafka/consumer.js
import { Kafka } from "kafkajs";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import fs from "fs";
import path from "path";
import { connectProducer, sendToDeadLetter } from "./producer.js";
import {
  messagesConsumed,
  validationPassed,
  validationFailed,
  deadLetterProduced,
} from "../metrics/metrics.js";

const kafka = new Kafka({
  clientId: "producer-validator",
  brokers: [process.env.KAFKA_BROKER],
});

const consumer = kafka.consumer({ groupId: process.env.KAFKA_GROUP_ID || "validator-group" });

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const schemaDir = path.resolve("/app/schemas");
const ticketSchemaPath = path.join(schemaDir, "radiology.ticket.v1.json");
const ticketSchema = JSON.parse(fs.readFileSync(ticketSchemaPath, "utf-8"));
const validate = ajv.compile(ticketSchema);

export const startConsumer = async () => {
  try {
    await connectProducer();
    await consumer.connect();
    console.log(`✅ Validator Kafka Consumer connected to ${process.env.KAFKA_BROKER}`);

    await consumer.subscribe({ topic: process.env.KAFKA_TOPIC || "radiology-events", fromBeginning: true });
    console.log(`📡 Subscribed to topic: ${process.env.KAFKA_TOPIC || "radiology-events"}`);

    await consumer.run({
      eachMessage: async ({ topic, message }) => {
        const data = JSON.parse(message.value.toString());
        messagesConsumed.inc();
        console.log("📥 Received message:", data);

        try {
          const valid = validate(data);
          if (!valid) {
            validationFailed.inc();
            console.error("❌ Validation errors:", validate.errors);

            await sendToDeadLetter("radiology-dead-letter", {
              original_topic: topic,
              original_message: data,
              validation_errors: validate.errors,
              received_at: new Date().toISOString(),
              provenance: {
                service: "validator-service",
                reason: "schema_validation_failed",
              },
            });

            deadLetterProduced.inc();
            return;
          }

          validationPassed.inc();
          console.log("✅ Message passed schema validation!");
        } catch (err) {
          validationFailed.inc();
          console.error("🚨 Processing error:", err);
        }
      },
    });
  } catch (err) {
    console.error("❌ Failed to start Validator Consumer:", err);
    process.exit(1);
  }
};
