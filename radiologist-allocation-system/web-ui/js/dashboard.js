const API_BASE = "http://localhost:8091/api";
const token = localStorage.getItem("token");

window.onload = () => {
  if (!token) {
    window.location.href = "index.html";
    return;
  }

  const name = localStorage.getItem("name");
  document.getElementById("doctorName").textContent = `Welcome, ${name}`;

  fetchAssignments();
};

function switchTab(tabId, element) {
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

  element.classList.add("active");
  document.getElementById(tabId).classList.add("active");

  if (tabId === "cases") {
    fetchAssignments();
  }
}

async function declareAvailability() {
  const start_time = document.getElementById("startTime").value;
  const end_time = document.getElementById("endTime").value;

  const res = await fetch(`${API_BASE}/availability`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ start_time, end_time }),
  });

  const data = await res.json();
  document.getElementById("availabilityMsg").textContent =
    data.ok ? "✅ Availability saved" : data.error;
}

async function applyLeave() {
  const start_date = document.getElementById("leaveStart").value;
  const end_date = document.getElementById("leaveEnd").value;
  const reason = document.getElementById("reason").value;

  const res = await fetch(`${API_BASE}/leaves`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ start_date, end_date, reason }),
  });

  const data = await res.json();
  document.getElementById("leaveMsg").textContent =
    data.ok ? "✅ Leave applied" : data.error;
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
      table.innerHTML = "<tr><td colspan='5'>No assignments</td></tr>";
      return;
    }

    data.data.forEach(a => {
      const row = `
        <tr>
          <td>${a.ticket_id}</td>
          <td>${a.priority || "-"}</td>
          <td>${a.status}</td>
          <td>${a.sla_minutes || "-"}</td>
          <td>${a.assigned_at ? new Date(a.assigned_at).toLocaleString() : "-"}</td>
        </tr>
      `;
      table.innerHTML += row;
    });

  } catch (err) {
    console.error("Assignment fetch error:", err);
  }
}

function logout() {
  localStorage.clear();
  window.location.href = "index.html";
}
