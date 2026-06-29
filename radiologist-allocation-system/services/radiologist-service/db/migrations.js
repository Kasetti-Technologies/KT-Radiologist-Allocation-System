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
      experience_years INT DEFAULT 0,
      certification_number VARCHAR(100),
      certification_authority VARCHAR(150),
      certification_verified BOOLEAN DEFAULT FALSE,
      certification_verified_at TIMESTAMP,
      certification_verified_by VARCHAR(150),
      verification_status VARCHAR(50) DEFAULT 'PENDING',
      email_verified BOOLEAN DEFAULT FALSE,
      email_verified_at TIMESTAMP,
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
    ADD COLUMN IF NOT EXISTS experience_years INT DEFAULT 0;
  `);

  await pool.query(`
    UPDATE radiologists
    SET experience_years = 0
    WHERE experience_years IS NULL;
  `);

  await pool.query(`
    ALTER TABLE radiologists
    ADD COLUMN IF NOT EXISTS experience_years INT DEFAULT 0;
  `);

  await pool.query(`
    UPDATE radiologists
    SET experience_years = 0
    WHERE experience_years IS NULL;
  `);

  await pool.query(`
    ALTER TABLE radiologists
    ADD COLUMN IF NOT EXISTS experience_years INT DEFAULT 0;
  `);

  await pool.query(`
    UPDATE radiologists
    SET experience_years = 0
    WHERE experience_years IS NULL;
  `);

  await pool.query(`
    ALTER TABLE radiologists
    ADD COLUMN IF NOT EXISTS certification_number VARCHAR(100);
  `);

  await pool.query(`
    ALTER TABLE radiologists
    ADD COLUMN IF NOT EXISTS certification_authority VARCHAR(150);
  `);

  await pool.query(`
    ALTER TABLE radiologists
    ADD COLUMN IF NOT EXISTS certification_verified BOOLEAN DEFAULT FALSE;
  `);

  await pool.query(`
    ALTER TABLE radiologists
    ADD COLUMN IF NOT EXISTS certification_verified_at TIMESTAMP;
  `);

  await pool.query(`
    ALTER TABLE radiologists
    ADD COLUMN IF NOT EXISTS certification_verified_by VARCHAR(150);
  `);

  await pool.query(`
    ALTER TABLE radiologists
    ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50) DEFAULT 'PENDING';
  `);

  await pool.query(`
    ALTER TABLE radiologists
    ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
  `);

  await pool.query(`
    ALTER TABLE radiologists
    ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP;
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_radiologists_certification_unique
    ON radiologists(certification_number)
    WHERE certification_number IS NOT NULL;
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_radiologists_certification_unique
    ON radiologists(certification_number)
    WHERE certification_number IS NOT NULL;
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_otps (
      id SERIAL PRIMARY KEY,
      radiologist_id INT REFERENCES radiologists(id) ON DELETE CASCADE,
      email VARCHAR(255) NOT NULL,
      purpose VARCHAR(50) NOT NULL,
      otp_hash TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP,
      attempts INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      last_sent_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_auth_otps_lookup
    ON auth_otps(email, purpose, used_at, expires_at);
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
