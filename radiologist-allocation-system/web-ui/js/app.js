// web-ui/js/app.js

const API_BASE = "http://localhost:8091/api";
const app = document.getElementById("app");

function showAlert(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerText = message;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

function renderLogin() {
  app.innerHTML = `
    <div class="container">
      <h2>🩻 Radiologist Login</h2>
      <input id="email" type="email" placeholder="Email" />
      <input id="password" type="password" placeholder="Password" />
      <button id="loginBtn">Login</button>
      <p style="text-align:center;">No account? <a id="registerLink" href="#">Register</a></p>
    </div>
  `;

  document.getElementById("loginBtn").onclick = login;
  document.getElementById("registerLink").onclick = renderRegister;
}

function renderRegister() {
  app.innerHTML = `
    <div class="container">
      <h2>🩻 Radiologist Register</h2>
      <input id="name" type="text" placeholder="Full Name" />
      <input id="email" type="email" placeholder="Email" />
      <input id="password" type="password" placeholder="Password" />
      <input id="specialization" type="text" placeholder="Specialization (e.g., MRI, CT)" />
      <button id="registerBtn">Register</button>
      <p style="text-align:center;">Already registered? <a id="loginLink" href="#">Login</a></p>
    </div>
  `;

  document.getElementById("registerBtn").onclick = register;
  document.getElementById("loginLink").onclick = renderLogin;
}

async function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      showAlert(data.error || "Invalid credentials", "error");
      return;
    }

    localStorage.setItem("token", data.token);
    localStorage.setItem("name", data.name);
    localStorage.setItem("specialization", data.specialization);

    showAlert("Login successful!", "success");

    setTimeout(() => {
      renderDashboard();
    }, 500);

  } catch (err) {
    console.error("Login error:", err);
    showAlert("Login failed due to network/server error", "error");
  }
}


async function register() {
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const specialization = document.getElementById("specialization").value.trim();

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, specialization }),
    });
    const data = await res.json();

    if (!data.ok) return showAlert(data.error, "error");

    showAlert("Registration successful! Please log in.", "success");
    setTimeout(renderLogin, 1000);
  } catch (err) {
    showAlert("Registration failed", "error");
  }
}

function renderDashboard() {
  const name = localStorage.getItem("name");

  app.innerHTML = `
    <div class="container">
      <h2>🩻 Radiologist Portal</h2>
      <p>Welcome, <b>${name}</b></p>

      <div class="tabs">
        <div class="tab active" onclick="switchTab('availability')">Time Slots</div>
        <div class="tab" onclick="switchTab('leave')">Leave</div>
        <div class="tab" onclick="switchTab('cases')">My Cases</div>
      </div>

      <!-- Availability -->
      <div id="availability" class="tab-content active">
        <label>Start Time</label>
        <input id="start_time" type="datetime-local" />
        <label>End Time</label>
        <input id="end_time" type="datetime-local" />
        <button onclick="submitAvailability()">Submit</button>
      </div>

      <!-- Leave -->
      <div id="leave" class="tab-content">
        <label>Start Date</label>
        <input id="start_date" type="date" />
        <label>End Date</label>
        <input id="end_date" type="date" />
        <label>Reason</label>
        <textarea id="reason"></textarea>
        <button onclick="applyLeave()">Apply Leave</button>
      </div>

      <!-- My Cases -->
      <div id="cases" class="tab-content">
        <button onclick="fetchAssignments()">Refresh</button>
        <br><br>
        <table>
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Priority</th>
              <th>Status</th>
              <th>SLA</th>
              <th>Assigned At</th>
            </tr>
          </thead>
          <tbody id="assignmentTable"></tbody>
        </table>
      </div>

      <div class="logout" onclick="logout()">Logout</div>
    </div>
  `;

  addTabStyles();
  fetchAssignments();
}


async function submitAvailability() {
  const start_time = document.getElementById("start_time").value;
  const end_time = document.getElementById("end_time").value;
  const token = localStorage.getItem("token");

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

    if (data.ok) showAlert("Availability submitted successfully!", "success");
    else showAlert(data.error, "error");
  } catch (err) {
    showAlert("Failed to submit availability", "error");
  }
}

async function applyLeave() {
  const start_date = document.getElementById("start_date").value;
  const end_date = document.getElementById("end_date").value;
  const reason = document.getElementById("reason").value.trim();
  const token = localStorage.getItem("token");

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

    if (data.ok) showAlert("Leave applied successfully!", "success");
    else showAlert(data.error, "error");
  } catch (err) {
    showAlert("Failed to apply leave", "error");
  }
}

function logout() {
  localStorage.clear();
  renderLogin();
}

function switchTab(tabId) {
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

  event.target.classList.add("active");
  document.getElementById(tabId).classList.add("active");
}

async function completeCase(ticket_id) {
  const token = localStorage.getItem("token");

  try {
    const res = await fetch(`${API_BASE}/complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        case_id: ticket_id,
        radiologist_id: 1   // optional if backend extracts from JWT
      }),
    });

    const data = await res.json();

    if (data.ok) {
      showAlert("Case marked as completed!", "success");
      fetchAssignments();
    } else {
      showAlert(data.error, "error");
    }

  } catch (err) {
    showAlert("Failed to complete case", "error");
  }
}


async function fetchAssignments() {
  const token = localStorage.getItem("token");

  try {
    const res = await fetch(`${API_BASE}/assignments`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    const table = document.getElementById("assignmentTable");
    table.innerHTML = "";

    const assignments = data.data || [];

    if (!assignments.length) {
      table.innerHTML = "<tr><td colspan='6'>No assignments</td></tr>";
      return;
    }

    assignments
  .filter(a => a.status !== "COMPLETED")
  .forEach(a => {
    table.innerHTML += `
      <tr>
        <td>${a.ticket_id}</td>
        <td>${a.patient_name || "-"}</td>
        <td>${a.priority}</td>
        <td>${a.status}</td>
        <td>
          <a href="${a.bahmni_url}" target="_blank">Open</a>
          <button class="complete-btn"
            onclick="completeCase('${a.ticket_id}')">
            Complete
          </button>
        </td>
        <td>${new Date(a.assigned_at).toLocaleString()}</td>
      </tr>
    `;
});


  } catch (err) {
    console.error("Assignment fetch error:", err);
  }
}


window.onload = () => {
  const token = localStorage.getItem("token");
  if (token) renderDashboard();
  else renderLogin();
};
