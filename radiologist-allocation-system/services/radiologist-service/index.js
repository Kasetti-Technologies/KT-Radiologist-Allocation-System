// services/radiologist-service/index.js
import express from "express";
import dotenv from "dotenv";
dotenv.config();
import cors from "cors";
import { runMigration } from "./db/migrations.js";
import { pool } from "./db/connect.js";

import authRoutes from "./routes/auth.js";
import radiologistsRoutes from "./routes/radiologists.js";
import availabilityRoutes from "./routes/availability.js";   // ✅ ADD THIS LINE
import leavesRoutes from "./routes/leaves.js";               // ✅ ADD THIS LINE
import completionRoutes from "./routes/completion.js";
import assignmentsRoutes from "./routes/assignments.js"; // ✅ NEW

const app = express();
app.use(express.json());
app.use(cors());

// Health check
app.get("/health", (req, res) => res.json({ ok: true, service: "radiologist-service" }));

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/radiologists", radiologistsRoutes);
app.use("/api/availability", availabilityRoutes);   // ✅ ADD THIS LINE
app.use("/api/leaves", leavesRoutes);               // ✅ ADD THIS LINE
app.use("/api/complete", completionRoutes); // ✅ NEW
app.use("/api/assignments", assignmentsRoutes); // ✅ NEW

const PORT = process.env.PORT || 8091;

runMigration().then(() => {
  app.listen(PORT, () => console.log(`🚀 Radiologist Service running on http://localhost:${PORT}`));
});
