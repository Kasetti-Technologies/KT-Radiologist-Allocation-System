import express from "express";
import bcrypt from "bcryptjs";
import { pool } from "../db/connect.js";
import { generateToken } from "../utils/auth.js";

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

router.post("/register", async (req, res) => {
  try {
    const { name, email, password, specialization } = req.body;
    const normalizedName = String(name || "").trim();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedSpecialization = normalizeSpecializationInput(specialization);

    if (!normalizedName || !normalizedEmail || !password || !normalizedSpecialization) {
      return res.status(400).json({ ok: false, error: "name, email, password, and specialization are required" });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ ok: false, error: "password must be at least 6 characters" });
    }

    const existingUser = await pool.query(
      `SELECT id FROM radiologists WHERE email = $1`,
      [normalizedEmail]
    );

    if (existingUser.rows[0]) {
      return res.status(409).json({ ok: false, error: "email already registered" });
    }

    const hash = await bcrypt.hash(password, 10);

    const insertResult = await pool.query(
      `INSERT INTO radiologists (name, email, password_hash, specialization)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, specialization, radiologist_code`,
      [normalizedName, normalizedEmail, hash, normalizedSpecialization]
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
       RETURNING id, radiologist_code, name, email, specialization`,
      [insertedUser.id, radiologistCode]
    );

    const user = updateResult.rows[0];
    if (!user) {
      return res.status(500).json({ ok: false, error: "Failed to finalize radiologist profile" });
    }

    const token = generateToken(user);

    res.json({
      ok: true,
      token,
      name: user.name,
      specialization: user.specialization,
      radiologist_code: user.radiologist_code
    });
  } catch (err) {
    console.error(err);
    if (err.code === "23505") {
      return res.status(409).json({ ok: false, error: "email already registered" });
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

    const token = generateToken(user);

    res.json({
      ok: true,
      token,
      name: user.name,
      specialization: user.specialization,
      radiologist_code: user.radiologist_code
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
