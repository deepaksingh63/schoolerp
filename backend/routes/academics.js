const express = require("express");
const db = require("../models/db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/subjects", (req, res) => res.json(db.prepare("SELECT * FROM subjects ORDER BY name").all()));
router.post("/subjects", requireRole("admin"), (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: "name is required" });
  try {
    const info = db.prepare("INSERT INTO subjects (name) VALUES (?)").run(name);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch {
    res.status(409).json({ error: "Subject already exists" });
  }
});

router.get("/examinations", (req, res) => res.json(db.prepare("SELECT * FROM examinations ORDER BY date DESC").all()));
router.post("/examinations", requireRole("admin"), (req, res) => {
  const { name, academicSession, date } = req.body || {};
  if (!name || !academicSession) return res.status(400).json({ error: "name and academicSession are required" });
  const info = db
    .prepare("INSERT INTO examinations (name, academic_session, date) VALUES (?,?,?)")
    .run(name, academicSession, date || null);
  res.status(201).json({ id: info.lastInsertRowid });
});

module.exports = router;
