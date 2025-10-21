// services/allocator-service/db/queries.js

export const createAssignmentsTable = `
  CREATE TABLE IF NOT EXISTS assignments (
    id SERIAL PRIMARY KEY,
    ticket_id VARCHAR(100) NOT NULL,
    radiologist_id VARCHAR(100),
    assigned_at TIMESTAMP DEFAULT NOW()
  );
`;

export const insertAssignment = `
  INSERT INTO assignments (ticket_id, radiologist_id)
  VALUES ($1, $2)
  RETURNING *;
`;
