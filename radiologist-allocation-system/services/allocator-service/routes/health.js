// services/allocator-service/routes/health.js
import express from "express";
const router = express.Router();

router.get("/health", (req, res) => {
  res.json({ status: "ok", service: "allocator-service" });
});

export default router;
