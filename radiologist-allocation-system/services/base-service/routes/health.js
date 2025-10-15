import express from "express";
const router = express.Router();

router.get("/health", (req, res) => {
  res.status(200).json({
    status: "UP",
    service: "Radiologist Allocation Base Service",
    timestamp: new Date().toISOString(),
  });
});

export default router;
