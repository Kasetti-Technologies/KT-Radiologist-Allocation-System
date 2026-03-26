const API_BASE = "http://localhost:8091/api";
const app = document.getElementById("app");

function showAlert(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

function renderShell(title, subtitle, formContent, footerHtml) {
  app.innerHTML = `
    <div class="overlay"></div>
    <div class="bg-orb bg-orb-one"></div>
    <div class="bg-orb bg-orb-two"></div>

    <main class="auth-shell">
      <section class="auth-hero">
        <p class="eyebrow">Radiology workflow</p>
        <h1>Radiologist Allocation Portal</h1>
        <p class="auth-copy">
          Coordinate registration, secure sign-in, live availability, leave tracking, and case review in one place.
        </p>
        <div class="auth-points">
          <div class="auth-point">Live assignment routing based on active availability</div>
          <div class="auth-point">Direct Bahmni access for assigned studies</div>
          <div class="auth-point">Clean workflow for leaves, cases, and completion updates</div>
        </div>
      </section>

      <section class="auth-card">
        <div class="auth-card-head">
          <p class="eyebrow">Radiologist access</p>
          <h2>${title}</h2>
          <p class="auth-subtitle">${subtitle}</p>
        </div>

        <div class="auth-form">
          ${formContent}
        </div>

        <div class="auth-footer">
          ${footerHtml}
        </div>
      </section>
    </main>
  `;
}

function renderLogin() {
  renderShell(
    "Sign In",
    "Access your dashboard to manage availability, leaves, and assigned cases.",
    `
      <div class="form-group">
        <label for="email">Email</label>
        <input id="email" type="email" placeholder="doctor@hospital.com" />
      </div>
      <div class="form-group">
        <label for="password">Password</label>
        <input id="password" type="password" placeholder="Enter your password" />
      </div>
      <button id="loginBtn" class="primary-btn auth-btn" type="button">Login</button>
    `,
    `
      <p class="auth-footer-text">No account yet?</p>
      <button id="registerLink" class="secondary-btn auth-switch-btn" type="button">Create account</button>
    `
  );

  document.getElementById("loginBtn").onclick = login;
  document.getElementById("registerLink").onclick = renderRegister;
}

function renderRegister() {
  renderShell(
    "Create Account",
    "Register a radiologist profile so the allocator can match cases by specialization and availability.",
    `
      <div class="form-group">
        <label for="name">Full Name</label>
        <input id="name" type="text" placeholder="Dr. Priya Nair" />
      </div>
      <div class="form-group">
        <label for="email">Email</label>
        <input id="email" type="email" placeholder="doctor@hospital.com" />
      </div>
      <div class="form-group">
        <label for="password">Password</label>
        <input id="password" type="password" placeholder="Choose a secure password" />
      </div>
      <div class="form-group">
        <label for="specialization">Specialization</label>
        <input id="specialization" type="text" placeholder="MRI, CT, X-Ray" />
        <p class="field-help">Use commas if the radiologist can read multiple modalities.</p>
      </div>
      <button id="registerBtn" class="primary-btn auth-btn" type="button">Register</button>
    `,
    `
      <p class="auth-footer-text">Already registered?</p>
      <button id="loginLink" class="secondary-btn auth-switch-btn" type="button">Back to login</button>
    `
  );

  document.getElementById("registerBtn").onclick = register;
  document.getElementById("loginLink").onclick = renderLogin;
}

async function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    showAlert("Email and password are required.", "error");
    return;
  }

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
    localStorage.setItem("specialization", data.specialization || "");

    showAlert("Login successful.", "success");
    setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 500);
  } catch (err) {
    console.error("Login error:", err);
    showAlert("Login failed due to network or server error.", "error");
  }
}

async function register() {
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const specialization = document.getElementById("specialization").value.trim();

  if (!name || !email || !password || !specialization) {
    showAlert("Please fill in all registration fields.", "error");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, specialization }),
    });
    const data = await res.json();

    if (!res.ok || !data.ok) {
      showAlert(data.error || "Registration failed.", "error");
      return;
    }

    showAlert("Registration successful. Please log in.", "success");
    setTimeout(renderLogin, 700);
  } catch (err) {
    console.error("Registration error:", err);
    showAlert("Registration failed.", "error");
  }
}

window.onload = () => {
  const token = localStorage.getItem("token");
  if (token) {
    window.location.href = "dashboard.html";
    return;
  }

  renderLogin();
};
