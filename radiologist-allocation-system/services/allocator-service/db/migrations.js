// services/allocator-service/db/migrations.js
import { pool } from "./connect.js";

export const runMigrations = async () => {
  console.log("🏗️  Running Allocator DB migrations...");

  // radiologists table (idempotent)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS radiologists (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      specialization TEXT NOT NULL,
      -- legacy column 'status' kept for compatibility (you can map to availability)
      status TEXT DEFAULT 'AVAILABLE',
      -- new columns for load balancing
      assigned_count INT DEFAULT 0,
      availability BOOLEAN DEFAULT TRUE
    );
  `);

  // assignments table (idempotent + SLA-related columns)
  await pool.query(`
  CREATE TABLE IF NOT EXISTS assignments (
    id SERIAL PRIMARY KEY,
    ticket_id TEXT NOT NULL,
    radiologist_id INT REFERENCES radiologists(id),
    radiologist_name TEXT,
    category TEXT,                    -- ✅ Added this
    created_at TIMESTAMP DEFAULT NOW(),
    assigned_at TIMESTAMP DEFAULT NOW(),
    priority INT,
    status TEXT DEFAULT 'PENDING',
    sla_minutes INT DEFAULT 30,
    escalated BOOLEAN DEFAULT FALSE
  );
`);

  // allocation audit
  await pool.query(`
    CREATE TABLE IF NOT EXISTS allocation_audit (
      id SERIAL PRIMARY KEY,
      ticket_id TEXT NOT NULL,
      radiologist_id INT,
      action TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  // indexes for performance
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_radiologists_specialization ON radiologists (specialization);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments (status);`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_assignments_ticket ON assignments (ticket_id);`);

  console.log("✅ DB migrations complete and verified.");
};
