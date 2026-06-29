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
          <div class="auth-point">Experience-aware priority for best-fit radiologist matching</div>
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
      <button id="forgotPasswordLink" class="text-link-btn" type="button">Forgot password?</button>
    `,
    `
      <p class="auth-footer-text">No account yet?</p>
      <button id="registerLink" class="secondary-btn auth-switch-btn" type="button">Create account</button>
    `
  );

  document.getElementById("loginBtn").onclick = login;
  document.getElementById("forgotPasswordLink").onclick = renderForgotPassword;
  document.getElementById("registerLink").onclick = renderRegister;
}

function renderOtpVerification(email) {
  renderShell(
    "Verify OTP",
    "Enter the 6-digit OTP sent to your registered email to complete login.",
    `
      <div class="otp-summary">
        <span>Email verification</span>
        <strong>${email}</strong>
      </div>
      <div class="form-group">
        <label for="otp">OTP</label>
        <input id="otp" type="text" inputmode="numeric" maxlength="6" placeholder="Enter 6-digit OTP" />
      </div>
      <button id="verifyOtpBtn" class="primary-btn auth-btn" type="button">Verify and Login</button>
      <button id="resendOtpBtn" class="secondary-btn auth-btn" type="button">Resend OTP</button>
    `,
    `
      <p class="auth-footer-text">Entered the wrong email?</p>
      <button id="backToLoginLink" class="secondary-btn auth-switch-btn" type="button">Back to login</button>
    `
  );

  document.getElementById("verifyOtpBtn").onclick = () => verifyLoginOtp(email);
  document.getElementById("resendOtpBtn").onclick = () => resendLoginOtp(email);
  document.getElementById("backToLoginLink").onclick = renderLogin;
}

function otpDeliveryMessage(data, fallbackMessage) {
  if (data?.dev_otp) {
    return `Local test OTP: ${data.dev_otp}`;
  }

  return fallbackMessage;
}

function renderForgotPassword() {
  renderShell(
    "Reset Password",
    "Enter your registered email. We will send an OTP to reset your password securely.",
    `
      <div class="form-group">
        <label for="resetEmail">Registered Email</label>
        <input id="resetEmail" type="email" placeholder="doctor@hospital.com" />
      </div>
      <button id="sendResetOtpBtn" class="primary-btn auth-btn" type="button">Send Reset OTP</button>
    `,
    `
      <p class="auth-footer-text">Remembered your password?</p>
      <button id="backToLoginLink" class="secondary-btn auth-switch-btn" type="button">Back to login</button>
    `
  );

  document.getElementById("sendResetOtpBtn").onclick = () => requestPasswordReset();
  document.getElementById("backToLoginLink").onclick = renderLogin;
}

function renderResetPassword(email) {
  renderShell(
    "Create New Password",
    "Enter the OTP from your email and choose a new password.",
    `
      <div class="otp-summary">
        <span>Password reset</span>
        <strong>${email}</strong>
      </div>
      <div class="form-group">
        <label for="resetOtp">OTP</label>
        <input id="resetOtp" type="text" inputmode="numeric" maxlength="6" placeholder="Enter 6-digit OTP" />
      </div>
      <div class="form-group">
        <label for="newPassword">New Password</label>
        <input id="newPassword" type="password" placeholder="Choose a new password" />
      </div>
      <button id="resetPasswordBtn" class="primary-btn auth-btn" type="button">Reset Password</button>
      <button id="resendResetOtpBtn" class="secondary-btn auth-btn" type="button">Resend Reset OTP</button>
    `,
    `
      <p class="auth-footer-text">Want to login instead?</p>
      <button id="backToLoginLink" class="secondary-btn auth-switch-btn" type="button">Back to login</button>
    `
  );

  document.getElementById("resetPasswordBtn").onclick = () => resetPassword(email);
  document.getElementById("resendResetOtpBtn").onclick = () => requestPasswordReset(email);
  document.getElementById("backToLoginLink").onclick = renderLogin;
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
      <div class="form-group priority-field">
        <div class="field-title-row">
          <label for="experienceYears">Experience Years</label>
          <span class="priority-pill">Priority factor</span>
        </div>
        <div class="number-affix">
          <input id="experienceYears" type="number" inputmode="numeric" min="0" max="60" placeholder="8" />
          <span>years</span>
        </div>
        <p class="field-help">Used by the allocator to prefer the most experienced verified and available radiologist.</p>
      </div>
      <div class="registration-insight">
        <strong>Assignment rule</strong>
        <span>Matched by modality, certification, availability, active workload, and experience.</span>
      </div>
      <div class="form-group">
        <label for="certificationNumber">Certification Number</label>
        <input id="certificationNumber" type="text" placeholder="MCI-REG-12345" />
      </div>
      <div class="form-group">
        <label for="certificationAuthority">Certification Authority</label>
        <input id="certificationAuthority" type="text" placeholder="National Medical Commission" />
        <p class="field-help">Assignments begin only after operations verifies this certification.</p>
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

    if (data.otp_required) {
      showAlert(otpDeliveryMessage(data, "OTP sent to your email."), "success");
      renderOtpVerification(data.email || email);
      return;
    }

    completeLogin(data);
  } catch (err) {
    console.error("Login error:", err);
    showAlert("Login failed due to network or server error.", "error");
  }
}

async function verifyLoginOtp(email) {
  const otp = document.getElementById("otp").value.trim();

  if (!otp) {
    showAlert("Please enter the OTP.", "error");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/login/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp }),
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      showAlert(data.error || "OTP verification failed.", "error");
      return;
    }

    completeLogin(data);
  } catch (err) {
    console.error("OTP verification error:", err);
    showAlert("Unable to verify OTP right now.", "error");
  }
}

async function resendLoginOtp(email) {
  try {
    const res = await fetch(`${API_BASE}/auth/login/resend-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();

    if (!res.ok || !data.ok) {
      showAlert(data.error || "Unable to resend OTP.", "error");
      return;
    }

    showAlert(otpDeliveryMessage(data, "OTP resent to email."), "success");
  } catch (err) {
    console.error("Resend OTP error:", err);
    showAlert("Unable to resend OTP right now.", "error");
  }
}

async function requestPasswordReset(forcedEmail) {
  const email = typeof forcedEmail === "string"
    ? forcedEmail.trim()
    : document.getElementById("resetEmail")?.value?.trim();

  if (!email) {
    showAlert("Please enter your registered email.", "error");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();

    if (!res.ok || !data.ok) {
      showAlert(data.error || "Unable to send reset OTP.", "error");
      return;
    }

    showAlert(otpDeliveryMessage(data, data.message || "Reset OTP sent."), "success");
    renderResetPassword(email);
  } catch (err) {
    console.error("Forgot password error:", err);
    showAlert("Unable to send reset OTP right now.", "error");
  }
}

async function resetPassword(email) {
  const otp = document.getElementById("resetOtp").value.trim();
  const new_password = document.getElementById("newPassword").value.trim();

  if (!otp || !new_password) {
    showAlert("OTP and new password are required.", "error");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp, new_password }),
    });
    const data = await res.json();

    if (!res.ok || !data.ok) {
      showAlert(data.error || "Password reset failed.", "error");
      return;
    }

    showAlert("Password reset successful. Please login.", "success");
    setTimeout(renderLogin, 700);
  } catch (err) {
    console.error("Reset password error:", err);
    showAlert("Unable to reset password right now.", "error");
  }
}

function completeLogin(data) {
    localStorage.setItem("token", data.token);
    localStorage.setItem("name", data.name);
    localStorage.setItem("specialization", data.specialization || "");
    localStorage.setItem("experience_years", String(data.experience_years ?? 0));
    localStorage.setItem("verification_status", data.verification_status || "PENDING");
    localStorage.setItem("certification_verified", String(Boolean(data.certification_verified)));

    showAlert("Login successful.", "success");
    setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 500);
}

async function register() {
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const specialization = document.getElementById("specialization").value.trim();
  const experience_years = document.getElementById("experienceYears").value.trim();
  const certification_number = document.getElementById("certificationNumber").value.trim();
  const certification_authority = document.getElementById("certificationAuthority").value.trim();

  if (!name || !email || !password || !specialization || !experience_years || !certification_number || !certification_authority) {
    showAlert("Please fill in all registration fields.", "error");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, specialization, experience_years, certification_number, certification_authority }),
    });
    const data = await res.json();

    if (!res.ok || !data.ok) {
      showAlert(data.error || "Registration failed.", "error");
      return;
    }

    showAlert("Registration submitted. Verification is pending.", "success");
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
