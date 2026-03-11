// services/radiologist-service/db/connect.js
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  host: process.env.DB_HOST || "ras_postgres",   // Docker service name
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || "dev",
  password: process.env.DB_PASSWORD || "dev",
  database: process.env.DB_NAME || "radiology",
  ssl: false
});

pool.on("connect", () => {
  console.log("✅ Connected to PostgreSQL (Radiologist Service)");
});

pool.on("error", (err) => {
  console.error("❌ Unexpected DB error", err);
  process.exit(1);
});

export { pool };
