import express from "express";
import bcrypt from "bcryptjs";
import { pool } from "../db/connect.js";
import { generateToken } from "../utils/auth.js";

const router = express.Router();

router.post("/register", async (req, res) => {
  try {
    const { name, email, password, specialization } = req.body;
    if (!name || !email || !password || !specialization)
      return res
        .status(400)
        .json({ ok: false, error: "name, email, password, specialization required" });

    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO radiologists (name, email, password_hash, specialization)
       VALUES ($1, $2, $3, $4)`,
      [name, email, hash, specialization]
    );

    const token = generateToken({ id: email, email });
    res.json({ ok: true, token, name, specialization });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const r = await pool.query(`SELECT * FROM radiologists WHERE email=$1`, [email]);
    const user = r.rows[0];
    if (!user) return res.status(404).json({ ok: false, error: "User not found" });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ ok: false, error: "Invalid password" });

    const token = generateToken(user);
    res.json({ ok: true, token, name: user.name, specialization: user.specialization });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
