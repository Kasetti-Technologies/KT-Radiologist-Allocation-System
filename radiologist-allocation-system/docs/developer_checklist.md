# Developer Checklist — Radiologist Allocation System (Phase 0)

This checklist ensures every developer has the same environment before starting any Jira story.

---

## 🖥️ 1. System Requirements
- OS: Windows 10/11 (Pro) or Linux/macOS
- Minimum RAM: 16 GB 
- Disk Space: 20 GB free
- Internet connection (for container image pulls)

---

## ⚙️ 2. Required Software & Tools
| Tool | Version | Purpose | Check Command |
|------|----------|----------|----------------|
| Git | latest | Version control | `git --version` |
| Docker Desktop | ≥ 4.30 | Container runtime | `docker version` |
| Docker Compose | v2 | Local stack orchestration | `docker compose version` |
| Node.js | 18 LTS + | For services & validators | `node -v` |
| npm | 9 + | Package manager | `npm -v` |
| PostgreSQL CLI | ≥ 15 | DB management | `psql --version` |
| Redis CLI | ≥ 7 | Cache/queue verification | `redis-cli ping` |
| Kafka CLI / Redpanda CLI | latest | Event streaming | `kafka-topics --version` |
| VS Code | latest | Development IDE |  |

---

## 🧰 3. Git Setup
```bash
git config --global user.name "Deekshithgowda007"
git config --global user.email "deekshithgowda977@gmail.com"
