// services/allocator-service/scripts/seed-radiologists.js
import dotenv from "dotenv";
import { pool } from "../db/connect.js";

dotenv.config();

const radiologists = [
  { name: "Dr. Ananya Rao", specialization: "MRI", status: "AVAILABLE" },
  { name: "Dr. Arjun Menon", specialization: "CT", status: "AVAILABLE" },
  { name: "Dr. Priya Sharma", specialization: "X-RAY", status: "AVAILABLE" },
  { name: "Dr. Neha Patel", specialization: "ULTRASOUND", status: "AVAILABLE" },
  { name: "Dr. Vikram Singh", specialization: "PET", status: "AVAILABLE" },
  { name: "Dr. Kiran Kumar", specialization: "Neuro", status: "AVAILABLE" },
];

const seedRadiologists = async () => {
  try {
    console.log("🧩 Seeding radiologists...");

    for (const r of radiologists) {
      await pool.query(
        `INSERT INTO radiologists (name, specialization, status)
         VALUES ($1, $2, $3)
         ON CONFLICT (name) DO NOTHING;`,
        [r.name, r.specialization, r.status]
      );
    }

    const { rows } = await pool.query(`SELECT * FROM radiologists;`);
    console.table(rows);

    console.log("✅ Radiologist seeding complete.");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error seeding radiologists:", err);
    process.exit(1);
  }
};

seedRadiologists();
