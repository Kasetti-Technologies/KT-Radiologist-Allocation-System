// services/producer-validator/metrics/metrics.js
import client from "prom-client";

const register = new client.Registry();
client.collectDefaultMetrics({ register });

// Custom counters
export const messagesConsumed = new client.Counter({
  name: "validator_messages_consumed_total",
  help: "Total number of messages consumed from Kafka",
});
export const validationPassed = new client.Counter({
  name: "validator_validation_passed_total",
  help: "Total number of messages that passed schema validation",
});
export const validationFailed = new client.Counter({
  name: "validator_validation_failed_total",
  help: "Total number of messages that failed schema validation",
});
export const deadLetterProduced = new client.Counter({
  name: "validator_dead_letter_produced_total",
  help: "Total number of messages sent to the dead-letter topic",
});

register.registerMetric(messagesConsumed);
register.registerMetric(validationPassed);
register.registerMetric(validationFailed);
register.registerMetric(deadLetterProduced);

// Expose Prometheus metrics endpoint
export const metricsEndpoint = async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
};
