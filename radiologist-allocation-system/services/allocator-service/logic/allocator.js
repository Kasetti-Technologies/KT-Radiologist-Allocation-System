/**
 * Selects and reserves one radiologist + one active slot atomically.
 * This function expects an open transaction and a pg client.
 */
export const allocateRadiologist = async (client, category, skills_required = [], excludeIds = []) => {
  const normalizedCategory = String(category || "").trim().toUpperCase();
  const normalizedSkills = (skills_required || [])
    .map((skill) => String(skill || "").trim().toUpperCase())
    .filter(Boolean);

  const params = [normalizedCategory];
  const specializationChecks = [
    `array_position(string_to_array(replace(upper(r.specialization), ' ', ''), ','), replace($1, ' ', '')) IS NOT NULL`
  ];

  if (normalizedSkills.length) {
    params.push(normalizedSkills);
    specializationChecks.push(`
      EXISTS (
        SELECT 1
        FROM unnest($2::text[]) AS skill
        WHERE array_position(string_to_array(replace(upper(r.specialization), ' ', ''), ','), replace(skill, ' ', '')) IS NOT NULL
      )
    `);
  }

  let excludeClause = "";
  if (excludeIds && excludeIds.length) {
    const startIndex = params.length + 1;
    const placeholders = excludeIds.map((_, index) => `$${startIndex + index}`).join(", ");
    excludeClause = `AND r.id NOT IN (${placeholders})`;
    params.push(...excludeIds);
  }

  const query = `
    SELECT
      r.id,
      r.name,
      r.email,
      r.specialization,
      r.assigned_count,
      r.availability,
      slot.id AS slot_id,
      slot.start_time,
      slot.end_time
    FROM radiologists r
    JOIN availability_slots slot
      ON slot.radiologist_id = r.id
     AND slot.is_booked = FALSE
     AND NOW() BETWEEN slot.start_time AND slot.end_time
    WHERE r.availability = TRUE
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
          AND a.status IN ('ASSIGNED', 'IN_REVIEW')
      )
      AND (${specializationChecks.join(" OR ")})
      ${excludeClause}
    ORDER BY r.assigned_count ASC, slot.start_time ASC, r.id ASC
    LIMIT 1
    FOR UPDATE OF r, slot SKIP LOCKED;
  `;

  const result = await client.query(query, params);
  const selected = result.rows[0];
  if (!selected) {
    return null;
  }

  await client.query(
    `UPDATE radiologists
     SET assigned_count = assigned_count + 1,
         availability = FALSE
     WHERE id = $1`,
    [selected.id]
  );

  await client.query(
    `UPDATE availability_slots
     SET is_booked = TRUE
     WHERE id = $1`,
    [selected.slot_id]
  );

  return selected;
};
