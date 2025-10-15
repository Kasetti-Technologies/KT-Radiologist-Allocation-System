import { query } from "./db.js";

(async () => {
  try {
    const result = await query("SELECT NOW() as current_time");
    console.log("✅ DB Connection Test Successful:", result.rows[0]);
    process.exit(0);
  } catch (err) {
    console.error("❌ DB Connection Failed:", err);
    process.exit(1);
  }
})();
