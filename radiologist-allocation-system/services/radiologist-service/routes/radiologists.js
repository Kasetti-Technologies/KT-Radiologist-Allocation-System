// services/radiologist-service/routes/radiologists.js
import express from "express";
import { pool } from "../db/connect.js";
const router = express.Router();

router.get("/", async (req, res) => {
  const result = await pool.query(`SELECT id, name, email, specialization, availability FROM radiologists`);
  res.json({ ok: true, data: result.rows });
});

export default router;
