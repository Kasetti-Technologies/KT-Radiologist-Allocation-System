const ALLOCATOR_API_BASE = "http://localhost:8082/api";
const RADIOLOGIST_API_BASE = "http://localhost:8091/api";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function opsHeaders() {
  const key = document.getElementById("opsKey")?.value?.trim();
  return key ? { "x-ops-key": key } : {};
}

function adminHeaders() {
  const key = document.getElementById("adminKey")?.value?.trim();
  return key ? { "x-admin-key": key } : {};
}

function statusClass(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "delivered" || normalized === "completed") return "completed";
  if (normalized === "breached" || normalized === "escalated" || normalized === "failed") return "breached";
  return "pending";
}

async function fetchJson(path, options = {}) {
  const baseUrl = options.baseUrl || ALLOCATOR_API_BASE;
  const { baseUrl: _baseUrl, ...fetchOptions } = options;
  const res = await fetch(`${baseUrl}${path}`, {
    ...fetchOptions,
    headers: {
      ...(fetchOptions.headers || {}),
      ...(baseUrl === ALLOCATOR_API_BASE ? opsHeaders() : {}),
    },
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data.data;
}

async function fetchAdminJson(path, options = {}) {
  const res = await fetch(`${RADIOLOGIST_API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...adminHeaders(),
    },
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data.data;
}

function renderSummary(summary) {
  const caseCounts = Object.fromEntries((summary.cases || []).map((item) => [item.status, item.count]));
  const webhookCounts = Object.fromEntries((summary.billing_webhooks || []).map((item) => [item.status, item.count]));

  document.getElementById("pendingCount").textContent = String(caseCounts.PENDING || 0);
  document.getElementById("breachedCount").textContent = String(caseCounts.BREACHED || 0);
  document.getElementById("escalatedCount").textContent = String(caseCounts.ESCALATED || 0);
  document.getElementById("webhookFailureCount").textContent = String(webhookCounts.FAILED || 0);
}

function renderCases(rows) {
  const table = document.getElementById("opsCasesTable");
  if (!rows.length) {
    table.innerHTML = `<tr><td colspan="7" class="no-data">No pending, breached, or escalated cases</td></tr>`;
    return;
  }

  table.innerHTML = rows.map((row) => `
    <tr>
      <td>${escapeHtml(row.ticket_id)}</td>
      <td>${escapeHtml(row.hospital_id || "-")}</td>
      <td>${escapeHtml(row.category || "-")}</td>
      <td><span class="status ${statusClass(row.status)}">${escapeHtml(row.status)}</span></td>
      <td>${escapeHtml(row.retry_count || 0)}</td>
      <td>${escapeHtml(row.reassignment_reason || "-")}</td>
      <td>${row.updated_at ? new Date(row.updated_at).toLocaleString() : "-"}</td>
    </tr>
  `).join("");
}

function renderWebhooks(rows) {
  const table = document.getElementById("webhookTable");
  if (!rows.length) {
    table.innerHTML = `<tr><td colspan="7" class="no-data">No failed billing callbacks</td></tr>`;
    return;
  }

  table.innerHTML = rows.map((row) => `
    <tr>
      <td>${row.id}</td>
      <td><span class="status ${statusClass(row.status)}">${escapeHtml(row.status)}</span></td>
      <td>${escapeHtml(row.http_status || "-")}</td>
      <td>${escapeHtml(row.attempts || 0)}</td>
      <td>${row.last_attempt_at ? new Date(row.last_attempt_at).toLocaleString() : "-"}</td>
      <td>${escapeHtml(row.response_body || row.error_message || "-")}</td>
      <td>
        <button class="refresh-btn" type="button" onclick="retryWebhook(${row.id})">Retry</button>
      </td>
    </tr>
  `).join("");
}

function renderRadiologists(rows) {
  const table = document.getElementById("radiologistTable");
  if (!rows.length) {
    table.innerHTML = `<tr><td colspan="7" class="no-data">No radiologists registered</td></tr>`;
    return;
  }

  table.innerHTML = rows.map((row) => {
    const verified = row.verification_status === "VERIFIED";
    return `
      <tr>
        <td>${escapeHtml(row.radiologist_code || row.id)}</td>
        <td>${escapeHtml(row.name)}</td>
        <td>${escapeHtml(row.specialization || "-")}</td>
        <td>
          <div class="ops-number-wrap">
            <input class="ops-number-input" id="experience-${row.id}" type="number" min="0" max="60" value="${escapeHtml(row.experience_years ?? 0)}" />
            <span>yrs</span>
          </div>
        </td>
        <td>${escapeHtml(row.certification_number || "-")}<br /><span class="panel-note">${escapeHtml(row.certification_authority || "-")}</span></td>
        <td><span class="status ${verified ? "completed" : "pending"}">${escapeHtml(row.verification_status || "PENDING")}</span></td>
        <td>
          <button class="complete-btn" type="button" onclick="verifyRadiologist(${row.id}, true)" ${verified ? "disabled" : ""}>Verify</button>
          <button class="danger-btn ops-action-secondary" type="button" onclick="verifyRadiologist(${row.id}, false)">Reject</button>
        </td>
      </tr>
    `;
  }).join("");
}

async function refreshOps() {
  try {
    const [summary, cases, webhooks, radiologists] = await Promise.all([
      fetchJson("/ops/summary"),
      fetchJson("/ops/cases"),
      fetchJson("/ops/billing-webhooks"),
      fetchJson("/radiologists", { baseUrl: RADIOLOGIST_API_BASE }),
    ]);

    renderSummary(summary);
    renderCases(cases);
    renderWebhooks(webhooks);
    renderRadiologists(radiologists);
  } catch (err) {
    alert(err.message);
  }
}

async function verifyRadiologist(id, verified) {
  try {
    const experienceInput = document.getElementById(`experience-${id}`);
    await fetchAdminJson(`/radiologists/${id}/verification`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        verified,
        verified_by: "operations-console",
        experience_years: experienceInput?.value,
      }),
    });
    await refreshOps();
  } catch (err) {
    alert(err.message);
  }
}

async function retryWebhook(id) {
  try {
    await fetchJson(`/ops/billing-webhooks/${id}/retry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    await refreshOps();
  } catch (err) {
    alert(err.message);
  }
}

window.onload = refreshOps;
