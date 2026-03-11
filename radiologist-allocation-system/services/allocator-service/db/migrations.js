// services/radiologist-service/db/migrations.js
import { pool } from "./connect.js";

export const runMigrations = async () => {
  console.log("🏗️ Running migrations for Radiologist Service...");

  // Radiologists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS radiologists (
      id SERIAL PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      email VARCHAR(150) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      specialization VARCHAR(100) NOT NULL,
      status VARCHAR(50) DEFAULT 'ACTIVE',
      assigned_count INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      availability BOOLEAN DEFAULT TRUE
    );
  `);

  // Availability
  await pool.query(`
    CREATE TABLE IF NOT EXISTS availability (
      id SERIAL PRIMARY KEY,
      radiologist_id INT REFERENCES radiologists(id) ON DELETE CASCADE,
      available_from TIMESTAMP NOT NULL,
      available_to TIMESTAMP NOT NULL,
      status VARCHAR(50) DEFAULT 'AVAILABLE',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Leaves
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leaves (
      id SERIAL PRIMARY KEY,
      radiologist_id INT REFERENCES radiologists(id) ON DELETE CASCADE,
      leave_from TIMESTAMP NOT NULL,
      leave_to TIMESTAMP NOT NULL,
      reason TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Assignments
  await pool.query(`
    CREATE TABLE IF NOT EXISTS assignments (
      id SERIAL PRIMARY KEY,
      ticket_id VARCHAR(100) UNIQUE NOT NULL,
      radiologist_id INT REFERENCES radiologists(id),
      radiologist_name VARCHAR(150),
      category VARCHAR(100),
      priority VARCHAR(50),
      sla_minutes INT,
      assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP,
      status VARCHAR(50) DEFAULT 'ASSIGNED',
      sla_status VARCHAR(50) DEFAULT 'WITHIN_SLA',
      breach BOOLEAN DEFAULT FALSE,
      bahmni_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      escalated BOOLEAN DEFAULT FALSE
    );
  `);


  // Audit Logs
  await pool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      ticket_id VARCHAR(100),
      radiologist_id INT,
      event_type VARCHAR(100),
      old_status VARCHAR(100),
      new_status VARCHAR(100),
      message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log("✅ Radiologist DB migrations completed successfully.");
};
