# Radiologist Allocation System

Radiologist Allocation System (RAS) — Kafka-driven, SLA-aware, skill-based routing engine for radiology reads.

## Quickstart (dev)
1. Install Docker & Docker Compose.
2. Copy `.env.example` → `.env` and fill required values.
3. Start local stack:
   ```bash
   cd infra
   docker-compose up -d
