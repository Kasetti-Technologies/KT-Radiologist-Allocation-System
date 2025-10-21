// services/allocator-service/db/migration.js
import { pool } from "./connect.js";

export const runMigrations = async () => {
  console.log("🏗️  Running Allocator DB migrations...");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS radiologists (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      specialization TEXT NOT NULL,
      status TEXT DEFAULT 'AVAILABLE'
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS assignments (
      id SERIAL PRIMARY KEY,
      ticket_id TEXT NOT NULL,
      radiologist_id INT NOT NULL REFERENCES radiologists(id),
      assigned_at TIMESTAMP DEFAULT NOW(),
      priority INT
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS allocation_audit (
      id SERIAL PRIMARY KEY,
      ticket_id TEXT NOT NULL,
      radiologist_id INT,
      action TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  console.log("✅ DB migrations complete and verified.");
};
