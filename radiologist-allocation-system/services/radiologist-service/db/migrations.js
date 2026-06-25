import { pool } from "./connect.js";

export const runMigration = async () => {
  console.log("🏗️ Running migrations for Radiologist Service...");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS radiologists (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      specialization VARCHAR(100),
      availability BOOLEAN DEFAULT true,
      operational_status VARCHAR(50) DEFAULT 'AVAILABLE',
      unavailable_since TIMESTAMP,
      unavailable_until TIMESTAMP,
      unavailable_reason TEXT,
      assigned_count INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE radiologists
    ADD COLUMN IF NOT EXISTS operational_status VARCHAR(50) DEFAULT 'AVAILABLE';
  `);

  await pool.query(`
    ALTER TABLE radiologists
    ADD COLUMN IF NOT EXISTS unavailable_since TIMESTAMP;
  `);

  await pool.query(`
    ALTER TABLE radiologists
    ADD COLUMN IF NOT EXISTS unavailable_until TIMESTAMP;
  `);

  await pool.query(`
    ALTER TABLE radiologists
    ADD COLUMN IF NOT EXISTS unavailable_reason TEXT;
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

  console.log("✅ Radiologist Service DB migrations completed");
};

if (process.argv[1].includes("migrations.js")) {
  runMigration()
    .then(() => {
      console.log("✅ Migration finished");
      process.exit(0);
    })
    .catch((err) => {
      console.error("❌ Migration failed:", err);
      process.exit(1);
    });
}
