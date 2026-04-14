const API_BASE = "http://localhost:8091/api";
const token = localStorage.getItem("token");

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function badgeClassFromStatus(status) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "ACTIVE") return "is-danger";
  if (normalized === "UPCOMING") return "is-pending";
  if (normalized === "COMPLETED") return "is-success";
  return "is-muted";
}

function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3200);
}

function setMessage(elementId, message, isError = false) {
  const element = document.getElementById(elementId);
  if (!element) return;

  element.textContent = message;
  element.classList.toggle("error", isError);
  element.classList.toggle("success", !isError && Boolean(message));
}

function normalizeBahmniUrl(url) {
  if (!url) return null;

  const trimmed = String(url).trim();
  if (!trimmed || trimmed.includes("<bahmni-host>")) {
    return null;
  }

  const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)
    ? trimmed
    : `http://${trimmed}`;

  try {
    return new URL(withProtocol).toString();
  } catch {
    return null;
  }
}

function toIsoFromLocalInput(value) {
  if (!value) return null;

  const localDate = new Date(value);
  if (Number.isNaN(localDate.getTime())) {
    return null;
  }

  return localDate.toISOString();
}

window.onload = () => {
  if (!token) {
    window.location.href = "index.html";
    return;
  }

  const name = localStorage.getItem("name") || "Doctor";
  const specialization = localStorage.getItem("specialization") || "Not set";
  document.getElementById("doctorName").textContent = `Welcome, Dr. ${name}`;
  document.getElementById("specializationText").textContent = specialization;

  fetchAvailability();
  fetchLeaves();
  fetchAssignments();
};

function switchTab(tabId, element) {
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach((content) => content.classList.remove("active"));

  element.classList.add("active");
  document.getElementById(tabId).classList.add("active");

  if (tabId === "cases") {
    fetchAssignments();
  }

  if (tabId === "availability") {
    fetchAvailability();
  }

  if (tabId === "leave") {
    fetchLeaves();
  }
}

function openBahmni(url) {
  const normalizedUrl = normalizeBahmniUrl(url);

  if (!normalizedUrl) {
    showToast("Valid Bahmni viewer link is not available for this case.", "error");
    return;
  }

  const link = document.createElement("a");
  link.href = normalizedUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function completeCase(id) {
  try {
    const res = await fetch(`${API_BASE}/assignments/${id}/complete`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();

    if (data.ok) {
      showToast("Case marked as completed.", "success");
      fetchAssignments();
    } else {
      showToast(data.error || "Failed to mark case complete.", "error");
    }
  } catch (err) {
    console.error(err);
    showToast("Unable to complete the case right now.", "error");
  }
}

async function fetchAssignments() {
  try {
    const res = await fetch(`${API_BASE}/assignments`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();
    const table = document.getElementById("assignmentTable");
    table.innerHTML = "";

    if (!data.ok || !data.data || data.data.length === 0) {
      document.getElementById("openCasesCount").textContent = "0";
      document.getElementById("completedCasesCount").textContent = "0";
      table.innerHTML = `<tr><td colspan="7" class="no-data">No assignments available</td></tr>`;
      return;
    }

    const assignments = data.data;
    const openCases = assignments.filter((assignment) => assignment.status !== "COMPLETED").length;
    const completedCases = assignments.filter((assignment) => assignment.status === "COMPLETED").length;
    document.getElementById("openCasesCount").textContent = String(openCases);
    document.getElementById("completedCasesCount").textContent = String(completedCases);

    assignments.forEach((assignment) => {
        const normalizedBahmniUrl = normalizeBahmniUrl(assignment.bahmni_url);
        const serializedUrl = normalizedBahmniUrl ? JSON.stringify(normalizedBahmniUrl) : null;
        const openBtn = normalizedBahmniUrl
          ? `<button class="open-btn" type="button" onclick='openBahmni(${serializedUrl})'>Open</button>`
          : `<span class="no-link">Link unavailable</span>`;
        const isCompleted = assignment.status === "COMPLETED";
        const completeButtonLabel = isCompleted ? "Completed" : "Complete";
        const completeButtonState = isCompleted ? "disabled" : "";
        const completeButtonClass = isCompleted ? "complete-btn is-completed" : "complete-btn";

        const row = `
          <tr>
            <td>${assignment.ticket_id}</td>
            <td>${assignment.category || "-"}</td>
            <td>${assignment.priority || "-"}</td>
            <td><span class="status ${(assignment.status || "assigned").toLowerCase()}">${assignment.status}</span></td>
            <td class="viewer-cell">${openBtn}</td>
            <td class="action-cell">
              <button class="${completeButtonClass}" type="button" onclick="completeCase('${assignment.id}')" ${completeButtonState}>
                ${completeButtonLabel}
              </button>
            </td>
            <td>${assignment.assigned_at ? new Date(assignment.assigned_at).toLocaleString() : "-"}</td>
          </tr>
        `;

        table.innerHTML += row;
      });
  } catch (err) {
    console.error("Assignment fetch error:", err);
    showToast("Failed to load assignments.", "error");
  }
}

async function declareAvailability() {
  const startValue = document.getElementById("startTime").value;
  const endValue = document.getElementById("endTime").value;
  const start_time = toIsoFromLocalInput(startValue);
  const end_time = toIsoFromLocalInput(endValue);

  if (!start_time || !end_time) {
    setMessage("availabilityMsg", "Please select both start and end time.", true);
    showToast("Please select both start and end time.", "error");
    return;
  }

  if (new Date(start_time) >= new Date(end_time)) {
    setMessage("availabilityMsg", "End time must be after start time.", true);
    showToast("End time must be after start time.", "error");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/availability`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ start_time, end_time }),
    });

    const data = await res.json();
    setMessage("availabilityMsg", data.ok ? "Availability saved successfully." : data.error, !data.ok);
    showToast(data.ok ? "Availability saved." : data.error || "Unable to save availability.", data.ok ? "success" : "error");
    if (data.ok) {
      fetchAvailability();
    }
  } catch (err) {
    console.error("Availability error:", err);
    setMessage("availabilityMsg", "Unable to save availability right now.", true);
    showToast("Unable to save availability right now.", "error");
  }
}

async function applyLeave() {
  const start_date = document.getElementById("leaveStart").value;
  const end_date = document.getElementById("leaveEnd").value;
  const reason = document.getElementById("reason").value;

  if (!start_date || !end_date) {
    setMessage("leaveMsg", "Please select both start and end date.", true);
    showToast("Please select both start and end date.", "error");
    return;
  }

  if (new Date(start_date) > new Date(end_date)) {
    setMessage("leaveMsg", "End date must be on or after start date.", true);
    showToast("End date must be on or after start date.", "error");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/leaves`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ start_date, end_date, reason }),
    });

    const data = await res.json();
    setMessage("leaveMsg", data.ok ? "Leave applied successfully." : data.error, !data.ok);
    showToast(data.ok ? "Leave applied." : data.error || "Unable to apply leave.", data.ok ? "success" : "error");
    if (data.ok) {
      fetchLeaves();
    }
  } catch (err) {
    console.error("Leave error:", err);
    setMessage("leaveMsg", "Unable to apply leave right now.", true);
    showToast("Unable to apply leave right now.", "error");
  }
}

function logout() {
  localStorage.clear();
  window.location.href = "index.html";
}

async function fetchAvailability() {
  try {
    const res = await fetch(`${API_BASE}/availability`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();
    const list = document.getElementById("availabilityList");
    if (!list) return;

    if (!data.ok || !Array.isArray(data.data) || data.data.length === 0) {
      document.getElementById("activeSlotsCount").textContent = "0";
      list.innerHTML = `<div class="empty-state">No availability slots submitted yet.</div>`;
      return;
    }

    const slots = data.data;
    const now = new Date();
    const activeCount = slots.filter((slot) => {
      const start = new Date(slot.start_time);
      const end = new Date(slot.end_time);
      return start <= now && now <= end;
    }).length;
    document.getElementById("activeSlotsCount").textContent = String(activeCount);

    list.innerHTML = slots.slice(0, 4).map((slot) => `
      <div class="list-item">
        <div>
          <strong>${new Date(slot.start_time).toLocaleString()}</strong>
          <p>to ${new Date(slot.end_time).toLocaleString()}</p>
        </div>
        <span class="mini-badge ${slot.is_booked ? "is-muted" : "is-success"}">${slot.is_booked ? "Booked" : "Open"}</span>
      </div>
    `).join("");
  } catch (err) {
    console.error("Availability fetch error:", err);
  }
}

async function fetchLeaves() {
  try {
    const res = await fetch(`${API_BASE}/leaves`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();
    const list = document.getElementById("leaveList");
    if (!list) return;

    if (!data.ok || !Array.isArray(data.data) || data.data.length === 0) {
      list.innerHTML = `<div class="empty-state">No leave requests submitted yet.</div>`;
      return;
    }

    list.innerHTML = data.data.slice(0, 4).map((leave) => `
      <div class="list-item">
        <div>
          <strong>${new Date(leave.start_date).toLocaleDateString()} to ${new Date(leave.end_date).toLocaleDateString()}</strong>
          <p>${escapeHtml(leave.reason || "No reason provided")}</p>
        </div>
        <span class="mini-badge ${badgeClassFromStatus(leave.display_status || leave.status)}">${escapeHtml(leave.display_status || leave.status || "PENDING")}</span>
      </div>
    `).join("");
  } catch (err) {
    console.error("Leave fetch error:", err);
  }
}
