const express = require("express");
const db = require("../models/db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/", (req, res) => {
  const classes = db.prepare("SELECT * FROM classes ORDER BY class_name").all();
  const sections = db.prepare("SELECT * FROM sections ORDER BY section_name").all();
  const withSections = classes.map((c) => ({
    ...c,
    sections: sections.filter((s) => s.class_id === c.id),
  }));
  res.json(withSections);
});

router.post("/", requireRole("admin"), (req, res) => {
  const { className, academicSession } = req.body || {};
  if (!className || !academicSession) return res.status(400).json({ error: "className and academicSession are required" });
  try {
    const info = db
      .prepare("INSERT INTO classes (class_name, academic_session) VALUES (?, ?)")
      .run(className, academicSession);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err) {
    res.status(409).json({ error: "That class already exists for this session" });
  }
});

router.post("/:classId/sections", requireRole("admin"), (req, res) => {
  const { sectionName } = req.body || {};
  if (!sectionName) return res.status(400).json({ error: "sectionName is required" });
  try {
    const info = db
      .prepare("INSERT INTO sections (class_id, section_name) VALUES (?, ?)")
      .run(req.params.classId, sectionName);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (err) {
    res.status(409).json({ error: "That section already exists for this class" });
  }
});

module.exports = router;
