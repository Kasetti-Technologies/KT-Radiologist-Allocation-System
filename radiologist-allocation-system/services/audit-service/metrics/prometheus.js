// services/audit-service/metrics/prometheus.js
import client from "prom-client";

export const register = new client.Registry();

// Counters for audit events
export const auditEventCounter = new client.Counter({
  name: "audit_events_total",
  help: "Total number of audit events received",
  labelNames: ["action", "radiologist", "category"],
});

register.registerMetric(auditEventCounter);

// Gauge for recent audit activity (per radiologist)
export const radiologistActivityGauge = new client.Gauge({
  name: "radiologist_activity_gauge",
  help: "Tracks number of assignments by radiologist (last window)",
  labelNames: ["radiologist", "category"],
});

register.registerMetric(radiologistActivityGauge);

// Default labels
register.setDefaultLabels({
  service: "audit-service",
});

client.collectDefaultMetrics({ register });

export default register;
