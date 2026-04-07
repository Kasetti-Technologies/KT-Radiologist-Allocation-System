import { pool } from "./connect.js";

export const runMigrations = async () => {
  console.log("Running migrations for Allocator Service...");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS radiologists (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      specialization VARCHAR(255),
      availability BOOLEAN DEFAULT true,
      assigned_count INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS availability_slots (
      id SERIAL PRIMARY KEY,
      radiologist_id INT REFERENCES radiologists(id) ON DELETE CASCADE,
      start_time TIMESTAMP NOT NULL,
      end_time TIMESTAMP NOT NULL,
      is_booked BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS leave_requests (
      id SERIAL PRIMARY KEY,
      radiologist_id INT REFERENCES radiologists(id) ON DELETE CASCADE,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      reason TEXT,
      status VARCHAR(50) DEFAULT 'PENDING',
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS assignments (
      id SERIAL PRIMARY KEY,
      ticket_id VARCHAR(100) UNIQUE NOT NULL,
      radiologist_id INT REFERENCES radiologists(id),
      radiologist_name VARCHAR(150),
      category VARCHAR(100),
      priority VARCHAR(50),
      sla_minutes INT,
      assigned_at TIMESTAMP,
      completed_at TIMESTAMP,
      status VARCHAR(50) DEFAULT 'PENDING',
      sla_status VARCHAR(50) DEFAULT 'WITHIN_SLA',
      breach BOOLEAN DEFAULT FALSE,
      bahmni_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      escalated BOOLEAN DEFAULT FALSE,
      booked_slot_id INT REFERENCES availability_slots(id),
      retry_count INT DEFAULT 0,
      last_retry_at TIMESTAMP
    );
  `);

  await pool.query(`
    ALTER TABLE assignments
    ADD COLUMN IF NOT EXISTS booked_slot_id INT REFERENCES availability_slots(id);
  `);

  await pool.query(`
    ALTER TABLE assignments
    ADD COLUMN IF NOT EXISTS retry_count INT DEFAULT 0;
  `);

  await pool.query(`
    ALTER TABLE assignments
    ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMP;
  `);

  await pool.query(`
    ALTER TABLE assignments
    ALTER COLUMN assigned_at DROP DEFAULT;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_assignments_status_created_at
    ON assignments(status, created_at);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_assignments_radiologist_status
    ON assignments(radiologist_id, status);
  `);

  console.log("Allocator Service DB migrations completed");
};
