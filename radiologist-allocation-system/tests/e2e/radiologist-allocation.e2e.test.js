import assert from "node:assert/strict";
import { test } from "node:test";

const RADIOLOGIST_API = process.env.RADIOLOGIST_API || "http://localhost:8091/api";
const ALLOCATOR_API = process.env.ALLOCATOR_API || "http://localhost:8082/api";
const MAILPIT_API = process.env.MAILPIT_API || "http://localhost:8025/api/v1";
const ADMIN_KEY = process.env.ADMIN_VERIFICATION_KEY || "change-me-admin-key";
const OPS_KEY = process.env.OPS_API_KEY || "change-me-ops-key";
const RUN_ID = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const TEST_MODALITY = `E2ECT${RUN_ID.replace(/[^a-zA-Z0-9]/g, "").slice(-8)}`;

function activeWindow() {
  return {
    start_time: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    end_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  };
}

async function request(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : {};

  if (!response.ok || body.ok === false) {
    throw new Error(`${options.method || "GET"} ${path} failed (${response.status}): ${body.error || text}`);
  }

  return body;
}

async function waitFor(description, fn, { timeoutMs = 30000, intervalMs = 1000 } = {}) {
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const result = await fn();
      if (result) return result;
    } catch (err) {
      lastError = err;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Timed out waiting for ${description}${lastError ? `: ${lastError.message}` : ""}`);
}

async function getLatestMailpitOtp(email, subjectIncludes = "OTP") {
  return waitFor(`Mailpit OTP for ${email}`, async () => {
    const response = await fetch(`${MAILPIT_API}/messages`);
    if (!response.ok) {
      throw new Error(`Mailpit messages failed: ${response.status}`);
    }

    const data = await response.json();
    const message = (data.messages || []).find((item) => {
      const toAddresses = (item.To || []).map((to) => String(to.Address || "").toLowerCase());
      return toAddresses.includes(email.toLowerCase()) && String(item.Subject || "").includes(subjectIncludes);
    });

    const otp = message?.Snippet?.match(/\b\d{6}\b/)?.[0];
    return otp || null;
  });
}

async function registerRadiologist({ name, specialization, experienceYears }) {
  const email = `${name.toLowerCase().replaceAll(" ", ".")}.${RUN_ID}@example.test`;
  const password = "Test@12345";
  const certification = `CERT-${RUN_ID}-${name.replaceAll(" ", "-")}`.toUpperCase();

  await request(RADIOLOGIST_API, "/auth/register", {
    method: "POST",
    body: JSON.stringify({
      name,
      email,
      password,
      specialization,
      experience_years: experienceYears,
      certification_number: certification,
      certification_authority: "National Radiology Board",
    }),
  });

  const login = await request(RADIOLOGIST_API, "/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  const loginOtp = login.dev_otp || await getLatestMailpitOtp(email, "OTP");
  const verifiedLogin = login.otp_required
    ? await request(RADIOLOGIST_API, "/auth/login/verify-otp", {
        method: "POST",
        body: JSON.stringify({ email, otp: loginOtp }),
      })
    : login;

  const radiologists = await request(RADIOLOGIST_API, "/radiologists");
  const profile = radiologists.data.find((item) => item.email === email);
  assert.ok(profile, `registered radiologist ${email} should be listed`);

  await request(RADIOLOGIST_API, `/radiologists/${profile.id}/verification`, {
    method: "PUT",
    headers: { "x-admin-key": ADMIN_KEY },
    body: JSON.stringify({
      verified: true,
      verified_by: "e2e-test",
      experience_years: experienceYears,
    }),
  });

  return {
    id: profile.id,
    email,
    token: verifiedLogin.token,
    name,
    specialization,
    experienceYears,
    radiologistCode: verifiedLogin.radiologist_code,
  };
}

async function setAvailability(radiologist) {
  return request(RADIOLOGIST_API, "/availability", {
    method: "POST",
    headers: { Authorization: `Bearer ${radiologist.token}` },
    body: JSON.stringify(activeWindow()),
  });
}

async function setStatus(radiologist, status, reason = "e2e workflow") {
  return request(RADIOLOGIST_API, "/status", {
    method: "PUT",
    headers: { Authorization: `Bearer ${radiologist.token}` },
    body: JSON.stringify({ status, reason }),
  });
}

async function getAssignments(radiologist) {
  const result = await request(RADIOLOGIST_API, "/assignments", {
    headers: { Authorization: `Bearer ${radiologist.token}` },
  });
  return result.data;
}

async function completeAssignment(radiologist, assignmentId) {
  return request(RADIOLOGIST_API, `/assignments/${assignmentId}/complete`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${radiologist.token}` },
  });
}

async function publishCase({ ticketId, category, hospitalId = "E2E-HOSPITAL" }) {
  return request(ALLOCATOR_API, "/publish", {
    method: "POST",
    body: JSON.stringify({
      topic: "radiology.validated",
      message: {
        ticket_id: ticketId,
        hospital_id: hospitalId,
        category,
        priority: 3,
        skills_required: [category],
        sla_minutes: 5,
        bahmni_url: `https://example.test/bahmni/ui?study_uid=${encodeURIComponent(ticketId)}`,
        study_uid: `1.2.826.0.1.${RUN_ID}.${ticketId}`,
        patient_uuid: `patient-${RUN_ID}`,
        encounter_uuid: `encounter-${RUN_ID}`,
      },
    }),
  });
}

async function findAssignment(radiologist, ticketId) {
  const assignments = await getAssignments(radiologist);
  return assignments.find((assignment) => assignment.ticket_id === ticketId);
}

async function opsCases(status = "PENDING,ESCALATED,BREACHED,ASSIGNED,COMPLETED") {
  const result = await request(ALLOCATOR_API, `/ops/cases?status=${encodeURIComponent(status)}`, {
    headers: { "x-ops-key": OPS_KEY },
  });
  return result.data;
}

test("end-to-end allocation flow prioritizes experience, reassigns emergency cases, and completes review", async () => {
  await waitFor("radiologist service", () => request(RADIOLOGIST_API, "/radiologists"));
  await waitFor("allocator service", () => request(ALLOCATOR_API, "/ops/summary", {
    headers: { "x-ops-key": OPS_KEY },
  }));

  const senior = await registerRadiologist({
    name: "E2E Senior CT",
    specialization: TEST_MODALITY,
    experienceYears: 18,
  });
  const backup = await registerRadiologist({
    name: "E2E Backup CT",
    specialization: TEST_MODALITY,
    experienceYears: 6,
  });

  await setAvailability(senior);
  await setAvailability(backup);

  const ticketId = `CASE-E2E-PRIORITY-${RUN_ID}`;
  await publishCase({ ticketId, category: TEST_MODALITY });

  const seniorAssignment = await waitFor("case assignment to most experienced CT radiologist", async () => {
    const assignment = await findAssignment(senior, ticketId);
    return assignment?.status === "ASSIGNED" ? assignment : null;
  });

  assert.equal(seniorAssignment.radiologist_id, senior.id);
  assert.equal(seniorAssignment.radiologist_name, senior.name);

  await setStatus(senior, "EMERGENCY_UNAVAILABLE", "Emergency case handoff test");

  const backupAssignment = await waitFor("emergency reassignment to backup CT radiologist", async () => {
    const assignment = await findAssignment(backup, ticketId);
    return assignment?.status === "ASSIGNED" ? assignment : null;
  });

  assert.equal(backupAssignment.radiologist_id, backup.id);
  assert.equal(backupAssignment.radiologist_name, backup.name);
  assert.equal(backupAssignment.previous_radiologist_id, senior.id);
  assert.match(backupAssignment.reassignment_reason, /emergency_unavailable/i);

  await completeAssignment(backup, backupAssignment.id);

  await waitFor("completed assignment status", async () => {
    const assignment = await findAssignment(backup, ticketId);
    return assignment?.status === "COMPLETED" ? assignment : null;
  });

  await setStatus(senior, "AVAILABLE", "E2E cleanup resume");
});

test("cases remain pending when no verified and available radiologist matches the modality", async () => {
  await waitFor("allocator service", () => request(ALLOCATOR_API, "/ops/summary", {
    headers: { "x-ops-key": OPS_KEY },
  }));

  const unmatchedModality = `E2EPET${RUN_ID.replace(/[^a-zA-Z0-9]/g, "").slice(-8)}`;
  const ticketId = `CASE-E2E-PENDING-${RUN_ID}`;
  await publishCase({ ticketId, category: unmatchedModality });

  const pending = await waitFor("pending unmatched PET case in operations queue", async () => {
    const cases = await opsCases("PENDING,ESCALATED,BREACHED");
    return cases.find((item) => item.ticket_id === ticketId);
  });

  assert.equal(pending.ticket_id, ticketId);
  assert.match(pending.status, /PENDING|ESCALATED|BREACHED/);
  assert.equal(pending.category, unmatchedModality);
});
