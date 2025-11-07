const API_BASE = "http://localhost:8090/api";
let token = localStorage.getItem("jwt");

async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (data.ok) {
    token = data.token;
    localStorage.setItem("jwt", token);
    document.getElementById("radiologistName").textContent = data.name;
    document.getElementById("loginSection").style.display = "none";
    document.getElementById("dashboard").style.display = "block";
  } else {
    alert(data.error || "Login failed");
  }
}

async function declareAvailability() {
  const day_of_week = document.getElementById("dayOfWeek").value;
  const start_time = document.getElementById("startTime").value;
  const end_time = document.getElementById("endTime").value;

  const res = await fetch(`${API_BASE}/availability`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ day_of_week, start_time, end_time }),
  });

  const data = await res.json();
  alert(data.ok ? "✅ Availability added!" : `❌ ${data.error}`);
}

async function applyLeave() {
  const leave_date = document.getElementById("leaveDate").value;
  const reason = document.getElementById("reason").value;

  const res = await fetch(`${API_BASE}/leaves`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ leave_date, reason }),
  });

  const data = await res.json();
  alert(data.ok ? "✅ Leave applied!" : `❌ ${data.error}`);
}

function logout() {
  localStorage.removeItem("jwt");
  token = null;
  document.getElementById("loginSection").style.display = "block";
  document.getElementById("dashboard").style.display = "none";
}
