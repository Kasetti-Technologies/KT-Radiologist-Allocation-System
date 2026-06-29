import express from "express";
import bcrypt from "bcryptjs";
import { pool } from "../db/connect.js";
import { generateToken } from "../utils/auth.js";
import { sendOtpEmail } from "../utils/mailer.js";

const router = express.Router();

function normalizeSpecializationInput(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)
    .filter((item, index, items) => items.indexOf(item) === index)
    .join(", ");
}

function buildRadiologistCode(id) {
  return `RAD${String(id).padStart(3, "0")}`;
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function otpExpiryDate() {
  const minutes = Number(process.env.OTP_EXPIRY_MINUTES || 10);
  return new Date(Date.now() + minutes * 60 * 1000);
}

async function createAndSendOtp(user, purpose) {
  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = otpExpiryDate();

  await pool.query(
    `UPDATE auth_otps
     SET used_at = NOW()
     WHERE email = $1
       AND purpose = $2
       AND used_at IS NULL`,
    [user.email, purpose]
  );

  await pool.query(
    `INSERT INTO auth_otps (radiologist_id, email, purpose, otp_hash, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [user.id, user.email, purpose, otpHash, expiresAt]
  );

  const mailResult = await sendOtpEmail({ to: user.email, otp, purpose });
  return {
    expires_at: expiresAt,
    delivery: mailResult.devFallback ? "DEV_LOG" : "EMAIL",
    dev_otp: mailResult.devFallback ? otp : undefined,
  };
}

async function verifyOtp({ email, otp, purpose }) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedOtp = String(otp || "").trim();

  if (!normalizedEmail || !/^\d{6}$/.test(normalizedOtp)) {
    return { ok: false, status: 400, error: "Valid email and 6-digit OTP are required" };
  }

  const otpResult = await pool.query(
    `SELECT *
     FROM auth_otps
     WHERE email = $1
       AND purpose = $2
       AND used_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [normalizedEmail, purpose]
  );

  const record = otpResult.rows[0];
  if (!record) {
    return { ok: false, status: 400, error: "OTP not found. Please request a new OTP." };
  }

  if (new Date(record.expires_at) < new Date()) {
    return { ok: false, status: 400, error: "OTP expired. Please resend OTP." };
  }

  if (record.attempts >= 5) {
    return { ok: false, status: 429, error: "Too many OTP attempts. Please resend OTP." };
  }

  const match = await bcrypt.compare(normalizedOtp, record.otp_hash);
  if (!match) {
    await pool.query(
      `UPDATE auth_otps
       SET attempts = attempts + 1
       WHERE id = $1`,
      [record.id]
    );
    return { ok: false, status: 401, error: "Invalid OTP" };
  }

  await pool.query(
    `UPDATE auth_otps
     SET used_at = NOW()
     WHERE id = $1`,
    [record.id]
  );

  const userResult = await pool.query(`SELECT * FROM radiologists WHERE email = $1`, [normalizedEmail]);
  const user = userResult.rows[0];
  if (!user) {
    return { ok: false, status: 404, error: "User not found" };
  }

  return { ok: true, user };
}

router.post("/register", async (req, res) => {
  try {
    const { name, email, password, specialization, experience_years, certification_number, certification_authority } = req.body;
    const normalizedName = String(name || "").trim();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedSpecialization = normalizeSpecializationInput(specialization);
    const parsedExperienceYears = Number.parseInt(experience_years, 10);
    const normalizedCertificationNumber = String(certification_number || "").trim().toUpperCase();
    const normalizedCertificationAuthority = String(certification_authority || "").trim();

    if (!normalizedName || !normalizedEmail || !password || !normalizedSpecialization || Number.isNaN(parsedExperienceYears) || !normalizedCertificationNumber || !normalizedCertificationAuthority) {
      return res.status(400).json({ ok: false, error: "name, email, password, specialization, experience years, certification number, and certification authority are required" });
    }

    if (parsedExperienceYears < 0 || parsedExperienceYears > 60) {
      return res.status(400).json({ ok: false, error: "experience years must be between 0 and 60" });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ ok: false, error: "password must be at least 6 characters" });
    }

    const existingUser = await pool.query(
      `SELECT id, email, certification_number
       FROM radiologists
       WHERE email = $1
          OR certification_number = $2`,
      [normalizedEmail, normalizedCertificationNumber]
    );

    if (existingUser.rows[0]) {
      if (existingUser.rows[0].certification_number === normalizedCertificationNumber) {
        return res.status(409).json({ ok: false, error: "certification number already registered" });
      }
      return res.status(409).json({ ok: false, error: "email already registered" });
    }

    const hash = await bcrypt.hash(password, 10);

    const insertResult = await pool.query(
      `INSERT INTO radiologists (
         name, email, password_hash, specialization, experience_years,
         certification_number, certification_authority,
         certification_verified, verification_status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE, 'PENDING')
       RETURNING id, name, email, specialization, experience_years, radiologist_code, certification_number, certification_authority, certification_verified, verification_status`,
      [
        normalizedName,
        normalizedEmail,
        hash,
        normalizedSpecialization,
        parsedExperienceYears,
        normalizedCertificationNumber,
        normalizedCertificationAuthority
      ]
    );

    const insertedUser = insertResult.rows[0];
    if (!insertedUser) {
      return res.status(500).json({ ok: false, error: "Failed to create radiologist" });
    }

    const radiologistCode = insertedUser.radiologist_code || buildRadiologistCode(insertedUser.id);
    const updateResult = await pool.query(
      `UPDATE radiologists
       SET radiologist_code = COALESCE(radiologist_code, $2)
       WHERE id = $1
       RETURNING id, radiologist_code, name, email, specialization, experience_years, certification_number, certification_authority, certification_verified, verification_status`,
      [insertedUser.id, radiologistCode]
    );

    const user = updateResult.rows[0];
    if (!user) {
      return res.status(500).json({ ok: false, error: "Failed to finalize radiologist profile" });
    }

    res.json({
      ok: true,
      name: user.name,
      specialization: user.specialization,
      experience_years: user.experience_years,
      radiologist_code: user.radiologist_code,
      certification_number: user.certification_number,
      certification_authority: user.certification_authority,
      certification_verified: user.certification_verified,
      verification_status: user.verification_status,
      email_verified: user.email_verified || false
    });
  } catch (err) {
    console.error(err);
    if (err.code === "23505") {
      return res.status(409).json({ ok: false, error: "email or certification number already registered" });
    }
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();

    const r = await pool.query(`SELECT * FROM radiologists WHERE email=$1`, [normalizedEmail]);
    const user = r.rows[0];

    if (!user) return res.status(404).json({ ok: false, error: "User not found" });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ ok: false, error: "Invalid password" });

    const radiologistCode = user.radiologist_code || buildRadiologistCode(user.id);
    if (!user.radiologist_code) {
      await pool.query(
        `UPDATE radiologists
         SET radiologist_code = $2
         WHERE id = $1`,
        [user.id, radiologistCode]
      );
      user.radiologist_code = radiologistCode;
    }

    const otpResult = await createAndSendOtp(user, "LOGIN");

    res.json({
      ok: true,
      otp_required: true,
      email: user.email,
      expires_at: otpResult.expires_at,
      delivery: otpResult.delivery,
      dev_otp: otpResult.dev_otp,
      message: "OTP sent to registered email"
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/login/verify-otp", async (req, res) => {
  try {
    const result = await verifyOtp({ email: req.body.email, otp: req.body.otp, purpose: "LOGIN" });
    if (!result.ok) {
      return res.status(result.status).json({ ok: false, error: result.error });
    }

    const user = result.user;
    await pool.query(
      `UPDATE radiologists
       SET email_verified = TRUE,
           email_verified_at = COALESCE(email_verified_at, NOW())
       WHERE id = $1`,
      [user.id]
    );
    user.email_verified = true;

    const token = generateToken(user);
    res.json({
      ok: true,
      token,
      name: user.name,
      specialization: user.specialization,
      experience_years: user.experience_years,
      radiologist_code: user.radiologist_code,
      certification_number: user.certification_number,
      certification_authority: user.certification_authority,
      certification_verified: user.certification_verified,
      verification_status: user.verification_status,
      email_verified: true
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/login/resend-otp", async (req, res) => {
  try {
    const normalizedEmail = String(req.body.email || "").trim().toLowerCase();
    const result = await pool.query(`SELECT * FROM radiologists WHERE email = $1`, [normalizedEmail]);
    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    const otpResult = await createAndSendOtp(user, "LOGIN");
    res.json({
      ok: true,
      expires_at: otpResult.expires_at,
      delivery: otpResult.delivery,
      dev_otp: otpResult.dev_otp,
      message: "OTP resent to registered email"
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/forgot-password", async (req, res) => {
  try {
    const normalizedEmail = String(req.body.email || "").trim().toLowerCase();
    const result = await pool.query(`SELECT * FROM radiologists WHERE email = $1`, [normalizedEmail]);
    const user = result.rows[0];

    let otpResult = null;
    if (user) {
      otpResult = await createAndSendOtp(user, "RESET_PASSWORD");
    }

    res.json({
      ok: true,
      delivery: otpResult?.delivery,
      dev_otp: otpResult?.dev_otp,
      message: "If this email is registered, a password reset OTP has been sent."
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const newPassword = String(req.body.new_password || "");
    if (newPassword.length < 6) {
      return res.status(400).json({ ok: false, error: "new password must be at least 6 characters" });
    }

    const result = await verifyOtp({ email: req.body.email, otp: req.body.otp, purpose: "RESET_PASSWORD" });
    if (!result.ok) {
      return res.status(result.status).json({ ok: false, error: result.error });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      `UPDATE radiologists
       SET password_hash = $2,
           email_verified = TRUE,
           email_verified_at = COALESCE(email_verified_at, NOW())
       WHERE id = $1`,
      [result.user.id, hash]
    );

    res.json({ ok: true, message: "Password reset successful. Please login with your new password." });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
