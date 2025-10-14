import { Kafka } from "kafkajs";
import fs from "fs-extra";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import chalk from "chalk";

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

const kafka = new Kafka({
  clientId: "radiology-producer",
  brokers: ["localhost:9092"]
});

const schemaPath = "../../schemas/radiology.ticket.v1.json";
const dataPath = "../../schemas/examples/valid.json";

async function produce() {
  const schema = await fs.readJSON(schemaPath);
  const data = await fs.readJSON(dataPath);

  const validate = ajv.compile(schema);
  const valid = validate(data);

  if (!valid) {
    console.log(chalk.red("❌ Data invalid, not producing:"));
    console.log(validate.errors);
    return;
  }

  const producer = kafka.producer();

  await producer.connect();
  console.log(chalk.yellow("🚀 Connected to Kafka — sending message..."));

  await producer.send({
    topic: "radiology.tickets",
    messages: [
      { key: data.ticket_id, value: JSON.stringify(data) }
    ],
  });

  console.log(chalk.green("✅ Message sent successfully to topic radiology.tickets"));
  await producer.disconnect();
}

produce().catch(console.error);
