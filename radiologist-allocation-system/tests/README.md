# End-to-End Tests

These tests run against the Docker services and exercise the production workflow:

- radiologist registration and login
- certification verification
- availability slot setup
- experience-priority assignment
- emergency unavailable handoff
- case completion
- pending queue when no matching radiologist is available

Start the stack first:

```bash
docker compose -f infra/docker-compose.yml up -d --build
```

Then run:

```bash
npm run test:e2e
```

Environment overrides:

```bash
RADIOLOGIST_API=http://localhost:8091/api
ALLOCATOR_API=http://localhost:8082/api
ADMIN_VERIFICATION_KEY=change-me-admin-key
OPS_API_KEY=change-me-ops-key
```
