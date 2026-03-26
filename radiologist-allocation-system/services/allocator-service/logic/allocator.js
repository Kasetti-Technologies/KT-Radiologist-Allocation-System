import { pool } from "../db/connect.js";

/**
 * allocateRadiologist(category, skills_required = [], excludeIds = [])
 * - one active case per radiologist at a time
 */
export const allocateRadiologist = async (category, skills_required = [], excludeIds = []) => {
  console.log(`Matching radiologist for category: ${category}`);

  try {
    const excludeClause = (excludeIds && excludeIds.length)
      ? `AND id NOT IN (${excludeIds.join(",")})`
      : "";

    const normalizedCategory = String(category || "").trim().toUpperCase();
    const normalizedSkills = (skills_required || [])
      .map((skill) => String(skill || "").trim().toUpperCase())
      .filter(Boolean);

    const query = `
      SELECT r.id, r.name, r.specialization, r.assigned_count, r.availability
      FROM radiologists r
      WHERE r.availability = TRUE
        AND EXISTS (
          SELECT 1
          FROM availability_slots slot
          WHERE slot.radiologist_id = r.id
            AND slot.is_booked = FALSE
            AND NOW() BETWEEN slot.start_time AND slot.end_time
        )
        AND NOT EXISTS (
          SELECT 1
          FROM leave_requests lr
          WHERE lr.radiologist_id = r.id
            AND CURRENT_DATE BETWEEN lr.start_date AND lr.end_date
        )
        AND NOT EXISTS (
          SELECT 1
          FROM assignments a
          WHERE a.radiologist_id = r.id
            AND a.status <> 'COMPLETED'
        )
        AND (
          array_position(string_to_array(replace(upper(r.specialization), ' ', ''), ','), replace($1, ' ', '')) IS NOT NULL
          ${normalizedSkills.length ? ` OR EXISTS (
            SELECT 1
            FROM unnest($2::text[]) AS skill
            WHERE array_position(string_to_array(replace(upper(r.specialization), ' ', ''), ','), replace(skill, ' ', '')) IS NOT NULL
          )` : ""}
        )
      ${excludeClause}
      ORDER BY RANDOM()
      LIMIT 1;
    `;

    const params = normalizedSkills.length
      ? [normalizedCategory, normalizedSkills]
      : [normalizedCategory];

    const result = await pool.query(query, params);
    const selected = result.rows[0];

    if (!selected) {
      console.warn(`No available radiologist found for ${category}`);
      return null;
    }

    console.log(`Selected radiologist: ${selected.name} (${selected.specialization})`);

    await pool.query(
      `UPDATE radiologists
         SET assigned_count = assigned_count + 1,
             availability = FALSE
       WHERE id = $1`,
      [selected.id]
    );

    return selected;
  } catch (err) {
    console.error("Error in allocation logic:", err);
    return null;
  }
};
