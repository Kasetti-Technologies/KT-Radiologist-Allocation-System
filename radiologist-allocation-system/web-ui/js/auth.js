const API_BASE = "http://localhost:8090/api/auth";

async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const msg = document.getElementById("message");

  const res = await fetch(`${API_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (data.ok) {
    localStorage.setItem("token", data.token);
    localStorage.setItem("name", data.name);
    window.location.href = "dashboard.html";
  } else {
    msg.textContent = data.error || "Login failed";
    msg.style.color = "red";
  }
}

function logout() {
  localStorage.clear();
  window.location.href = "index.html";
}
