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

router.post("/register", async (req, res) => {
  try {
    const { name, email, password, specialization } = req.body;
    const normalizedSpecialization = normalizeSpecializationInput(specialization);

    if (!name || !email || !password || !normalizedSpecialization) {
      return res.status(400).json({ ok: false, error: "name, email, password, and specialization are required" });
    }

    const hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO radiologists (name, email, password_hash, specialization)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, specialization`,
      [name.trim(), email.trim().toLowerCase(), hash, normalizedSpecialization]
    );

    const user = result.rows[0];
    const token = generateToken(user);

    res.json({ ok: true, token, name: user.name, specialization: user.specialization });
  } catch (err) {
    console.error(err);
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

    const token = generateToken(user);

    res.json({
      ok: true,
      token,
      name: user.name,
      specialization: user.specialization
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
