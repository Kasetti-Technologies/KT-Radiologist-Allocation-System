// services/allocator-service/logic/allocator.js
import { pool } from "../db/connect.js";

export const allocateRadiologist = async (category, skills_required) => {
  try {
    const skillsList = skills_required.map(s => `'${s}'`).join(",");
    const query = `
      SELECT id, name, specialization, status
      FROM radiologists
      WHERE status = 'AVAILABLE'
      AND (specialization = ANY (ARRAY[${skillsList}]) OR specialization = $1)
      ORDER BY RANDOM()
      LIMIT 1;
    `;
    const result = await pool.query(query, [category]);
    return result.rows[0] || null;
  } catch (err) {
    console.error("❌ Error allocating radiologist:", err);
    return null;
  }
};
