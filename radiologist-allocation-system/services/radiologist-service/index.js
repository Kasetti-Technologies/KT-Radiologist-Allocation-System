import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { runMigration } from "./db/migrations.js";

import authRoutes from "./routes/auth.js";
import radiologistsRoutes from "./routes/radiologists.js";
import availabilityRoutes from "./routes/availability.js";
import leavesRoutes from "./routes/leaves.js";
import completionRoutes from "./routes/completion.js";
import assignmentsRoutes from "./routes/assignments.js";
import statusRoutes from "./routes/status.js";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

app.get("/health", (req, res) => res.json({ ok: true, service: "radiologist-service" }));

app.use("/api/auth", authRoutes);
app.use("/api/radiologists", radiologistsRoutes);
app.use("/api/availability", availabilityRoutes);
app.use("/api/leaves", leavesRoutes);
app.use("/api/complete", completionRoutes);
app.use("/api/assignments", assignmentsRoutes);
app.use("/api/status", statusRoutes);

const PORT = process.env.PORT || 8091;

runMigration().then(() => {
  app.listen(PORT, () => console.log(`Radiologist Service running on http://localhost:${PORT}`));
});
