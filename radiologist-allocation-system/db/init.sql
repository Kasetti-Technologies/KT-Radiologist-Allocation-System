-- init.sql
-- CREATE DATABASE radiology;
-- \c radiology;

CREATE SCHEMA IF NOT EXISTS ras AUTHORIZATION dev;

-- Example table for Phase 1
CREATE TABLE IF NOT EXISTS ras.radiologist_allocation (
    id SERIAL PRIMARY KEY,
    ticket_id VARCHAR(50) NOT NULL,
    radiologist_id VARCHAR(50) NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'ASSIGNED',
    priority INT,
    sla_minutes INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
