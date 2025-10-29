// services/allocator-service/logic/allocator.js
import { pool } from "../db/connect.js";

/**
 * allocateRadiologist(category, skills_required = [], excludeIds = [])
 * - returns a radiologist row { id, name, specialization, assigned_count, availability } or null
 */
export const allocateRadiologist = async (category, skills_required = [], excludeIds = []) => {
  console.log(`🔍 Matching radiologist for category: ${category}`);

  try {
    // Build SQL components
    const excludeClause = (excludeIds && excludeIds.length) ? `AND id NOT IN (${excludeIds.join(",")})` : "";
    // Use postgres ANY() for skills array - ensure we pass an array param
    // We'll supply skills_required as a Postgres array param ($2) and category as $1
    const query = `
      SELECT r.id, r.name, r.specialization, r.assigned_count, r.availability
      FROM radiologists r
      WHERE r.availability = TRUE
        AND (
              r.specialization = $1
              ${skills_required && skills_required.length ? ` OR r.specialization = ANY($2)` : ""}
        )
      ${excludeClause}
      ORDER BY r.assigned_count ASC, RANDOM()
      LIMIT 1;
    `;

    const params = skills_required && skills_required.length ? [category, skills_required] : [category];
    const result = await pool.query(query, params);
    const selected = result.rows[0];
    if (!selected) {
      console.warn(`⚠️ No available radiologist found for ${category}`);
      return null;
    }

    console.log(`✅ Selected radiologist: ${selected.name} (${selected.specialization})`);

    // increment assigned_count and update availability threshold (e.g., lock when >= 5)
    await pool.query(
      `UPDATE radiologists
         SET assigned_count = assigned_count + 1,
             availability = CASE WHEN assigned_count + 1 >= 5 THEN FALSE ELSE TRUE END
       WHERE id = $1`,
      [selected.id]
    );

    // return selected (note: assigned_count returned here is pre-increment value)
    return selected;
  } catch (err) {
    console.error("❌ Error in allocation logic:", err);
    return null;
  }
};
