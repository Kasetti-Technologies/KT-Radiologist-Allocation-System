// web-ui/js/app.js

const API_BASE = "http://localhost:8090/api";
const app = document.getElementById("app");

function showAlert(message, type = "success") {
  const alert = document.createElement("div");
  alert.className = `alert ${type === "success" ? "alert-success" : "alert-error"}`;
  alert.textContent = message;
  app.prepend(alert);
  setTimeout(() => alert.remove(), 4000);
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

    if (!data.ok) return showAlert(data.error, "error");

    localStorage.setItem("token", data.token);
    localStorage.setItem("name", data.name);
    localStorage.setItem("specialization", data.specialization);
    renderDashboard();
  } catch (err) {
    showAlert("Login failed", "error");
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

      <label>Start Time</label>
      <input id="start_time" type="datetime-local" />
      <label>End Time</label>
      <input id="end_time" type="datetime-local" />
      <button id="availabilityBtn">Submit Availability</button>

      <hr />
      <label>Leave Start Date</label>
      <input id="start_date" type="date" />
      <label>Leave End Date</label>
      <input id="end_date" type="date" />
      <label>Reason</label>
      <textarea id="reason" placeholder="Reason for leave"></textarea>
      <button id="leaveBtn">Apply Leave</button>

      <div class="logout" id="logoutBtn">Logout</div>
    </div>
  `;

  document.getElementById("availabilityBtn").onclick = submitAvailability;
  document.getElementById("leaveBtn").onclick = applyLeave;
  document.getElementById("logoutBtn").onclick = logout;
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

window.onload = () => {
  const token = localStorage.getItem("token");
  if (token) renderDashboard();
  else renderLogin();
};
