const express = require("express");
const db = require("../models/db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

function teacherOwnsClassSection(teacherId, classId, sectionId) {
  const row = db
    .prepare(
      "SELECT 1 FROM teacher_assignments WHERE teacher_id = ? AND class_id = ? AND section_id = ?"
    )
    .get(teacherId, classId, sectionId);
  return !!row;
}

// GET /api/attendance?classId=&sectionId=&date=   (teacher: only own assigned class/section, admin: any)
router.get("/", requireRole("admin", "teacher"), (req, res) => {
  const { classId, sectionId, date } = req.query;
  if (!classId || !sectionId) return res.status(400).json({ error: "classId and sectionId are required" });

  if (req.user.role === "teacher" && !teacherOwnsClassSection(req.user.linked_teacher_id, classId, sectionId)) {
    return res.status(403).json({ error: "You are not assigned to this class/section" });
  }

  let sql = `SELECT s.id as student_id, s.name, s.roll_number, a.status, a.date
             FROM students s
             LEFT JOIN attendance a ON a.student_id = s.id AND a.date = ?
             WHERE s.class_id = ? AND s.section_id = ? AND s.status = 'active'
             ORDER BY s.roll_number`;
  const rows = db.prepare(sql).all(date || new Date().toISOString().slice(0, 10), classId, sectionId);
  res.json(rows);
});

// GET own attendance summary/history: /api/attendance/student/:id
router.get("/student/:id", (req, res) => {
  const studentId = Number(req.params.id);

  if (req.user.role === "admin") {
    // allowed
  } else if (req.user.role === "teacher") {
    const student = db.prepare("SELECT class_id, section_id FROM students WHERE id = ?").get(studentId);
    if (!student || !teacherOwnsClassSection(req.user.linked_teacher_id, student.class_id, student.section_id)) {
      return res.status(403).json({ error: "You cannot view this student's attendance" });
    }
  } else {
    // student / parent — must be their OWN linked student; the :id in the URL is never trusted alone
    if (req.user.linked_student_id !== studentId) {
      return res.status(403).json({ error: "You can only view your own attendance" });
    }
  }

  const records = db
    .prepare("SELECT date, status FROM attendance WHERE student_id = ? ORDER BY date DESC")
    .all(studentId);
  const present = records.filter((r) => r.status === "present").length;
  const total = records.length;
  const percentage = total > 0 ? Math.round((present / total) * 1000) / 10 : null;

  res.json({ records, summary: { workingDays: total, present, absent: total - present, percentage } });
});

// POST /api/attendance  (teacher only, own class/section) — bulk mark for a date
// body: { classId, sectionId, date, entries: [{ studentId, status }] }
router.post("/", requireRole("teacher"), (req, res) => {
  const { classId, sectionId, date, entries } = req.body || {};
  if (!classId || !sectionId || !date || !Array.isArray(entries)) {
    return res.status(400).json({ error: "classId, sectionId, date and entries[] are required" });
  }
  if (!teacherOwnsClassSection(req.user.linked_teacher_id, classId, sectionId)) {
    return res.status(403).json({ error: "You are not assigned to this class/section" });
  }

  const upsert = db.prepare(
    `INSERT INTO attendance (student_id, date, status, marked_by)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(student_id, date) DO UPDATE SET status = excluded.status, marked_by = excluded.marked_by`
  );

  const tx = db.transaction((rows) => {
    for (const e of rows) {
      if (!e.studentId || !["present", "absent"].includes(e.status)) continue;
      upsert.run(e.studentId, date, e.status, req.user.linked_teacher_id);
    }
  });

  try {
    tx(entries);
    res.status(201).json({ message: "Attendance saved" });
  } catch (err) {
    res.status(500).json({ error: "Could not save attendance" });
  }
});

module.exports = router;
