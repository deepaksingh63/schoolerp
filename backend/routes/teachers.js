const express = require("express");
const db = require("../models/db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/", requireRole("admin"), (req, res) => {
  const teachers = db.prepare("SELECT * FROM teachers ORDER BY name").all();
  res.json(teachers);
});

router.get("/:id", (req, res) => {
  if (req.user.role !== "admin" && req.user.linked_teacher_id !== Number(req.params.id)) {
    return res.status(403).json({ error: "You cannot access this teacher's data" });
  }
  const teacher = db.prepare("SELECT * FROM teachers WHERE id = ?").get(req.params.id);
  if (!teacher) return res.status(404).json({ error: "Teacher not found" });
  const assignments = db
    .prepare(
      `SELECT ta.*, c.class_name, sec.section_name FROM teacher_assignments ta
       JOIN classes c ON c.id = ta.class_id
       JOIN sections sec ON sec.id = ta.section_id
       WHERE ta.teacher_id = ?`
    )
    .all(teacher.id);
  res.json({ teacher, assignments });
});

router.post("/", requireRole("admin"), (req, res) => {
  const { registrationNumber, name, qualification, mobile, email, photo } = req.body || {};
  if (!registrationNumber || !name) {
    return res.status(400).json({ error: "registrationNumber and name are required" });
  }
  const teacherCode = "TCH-" + registrationNumber;
  try {
    const info = db
      .prepare(
        `INSERT INTO teachers (registration_number, teacher_code, name, photo, qualification, mobile, email)
         VALUES (?,?,?,?,?,?,?)`
      )
      .run(registrationNumber, teacherCode, name, photo || null, qualification || null, mobile || null, email || null);
    res.status(201).json({ id: info.lastInsertRowid, message: "Teacher created" });
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) {
      return res.status(409).json({ error: "That registration number is already in use" });
    }
    res.status(500).json({ error: "Could not create teacher" });
  }
});

router.put("/:id", requireRole("admin"), (req, res) => {
  const fields = ["name", "qualification", "mobile", "email", "status", "photo"];
  const body = req.body || {};
  const sets = [];
  const params = [];
  for (const f of fields) {
    if (body[f] !== undefined) { sets.push(`${f} = ?`); params.push(body[f]); }
  }
  if (sets.length === 0) return res.status(400).json({ error: "Nothing to update" });
  params.push(req.params.id);
  db.prepare(`UPDATE teachers SET ${sets.join(", ")} WHERE id = ?`).run(...params);
  res.json({ message: "Teacher updated" });
});

// Assign teacher -> class -> section -> subject (admin only)
router.post("/:id/assignments", requireRole("admin"), (req, res) => {
  const { classId, sectionId, subject } = req.body || {};
  if (!classId || !sectionId || !subject) {
    return res.status(400).json({ error: "classId, sectionId and subject are required" });
  }
  const info = db
    .prepare("INSERT INTO teacher_assignments (teacher_id, class_id, section_id, subject) VALUES (?,?,?,?)")
    .run(req.params.id, classId, sectionId, subject);
  res.status(201).json({ id: info.lastInsertRowid, message: "Assignment created" });
});

module.exports = router;
