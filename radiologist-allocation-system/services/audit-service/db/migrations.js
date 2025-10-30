// services/audit-service/db/migrations.js
import { pool } from "./connect.js";

export const runMigrations = async () => {
  console.log("🏗️ Running migrations for Audit Service...");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      ticket_id VARCHAR(100) NOT NULL,
      radiologist_id INT,
      radiologist_name VARCHAR(255),
      category VARCHAR(100),
      action VARCHAR(100),
      created_at TIMESTAMP DEFAULT NOW(),
      raw_event JSONB
    );
  `);

  console.log("✅ audit_logs table ready in database");
};
