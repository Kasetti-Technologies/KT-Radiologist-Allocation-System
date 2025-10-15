import pg from "pg";
import dotenv from "dotenv";
dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  user: process.env.DB_USER || "dev",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "radiology",
  password: process.env.DB_PASSWORD || "dev",
  port: process.env.DB_PORT || 5432,
});

pool.on("connect", () => {
  console.log("✅ Connected to PostgreSQL successfully!");
});

pool.on("error", (err) => {
  console.error("❌ Unexpected error on idle PostgreSQL client", err);
  process.exit(-1);
});

export const query = async (text, params) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log("🧮 executed query", { text, duration, rows: res.rowCount });
  return res;
};
