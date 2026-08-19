const express = require("express");
const db = require("../models/db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

function computeGrade(pct) {
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B+";
  if (pct >= 60) return "B";
  if (pct >= 50) return "C";
  if (pct >= 33) return "D";
  return "F";
}

function teacherCanGradeStudent(teacherId, studentId) {
  const student = db.prepare("SELECT class_id, section_id FROM students WHERE id = ?").get(studentId);
  if (!student) return false;
  const row = db
    .prepare(
      "SELECT 1 FROM teacher_assignments WHERE teacher_id = ? AND class_id = ? AND section_id = ?"
    )
    .get(teacherId, student.class_id, student.section_id);
  return !!row;
}

// GET /api/marks?studentId=
router.get("/", (req, res) => {
  const { studentId } = req.query;
  if (!studentId) return res.status(400).json({ error: "studentId is required" });
  const id = Number(studentId);

  if (req.user.role === "teacher" && !teacherCanGradeStudent(req.user.linked_teacher_id, id)) {
    return res.status(403).json({ error: "You cannot view this student's marks" });
  }
  if (["student", "parent"].includes(req.user.role) && req.user.linked_student_id !== id) {
    return res.status(403).json({ error: "You can only view your own academic records" });
  }

  const rows = db
    .prepare(
      `SELECT m.*, sub.name as subject_name, ex.name as examination_name
       FROM marks m
       JOIN subjects sub ON sub.id = m.subject_id
       JOIN examinations ex ON ex.id = m.examination_id
       WHERE m.student_id = ?
       ORDER BY ex.date DESC, sub.name`
    )
    .all(id);
  res.json(rows);
});

// POST /api/marks (teacher only, own assigned students)
router.post("/", requireRole("teacher"), (req, res) => {
  const { studentId, subjectId, examinationId, maximumMarks, obtainedMarks, remarks } = req.body || {};
  if (!studentId || !subjectId || !examinationId || maximumMarks == null || obtainedMarks == null) {
    return res.status(400).json({ error: "studentId, subjectId, examinationId, maximumMarks and obtainedMarks are required" });
  }
  if (!teacherCanGradeStudent(req.user.linked_teacher_id, studentId)) {
    return res.status(403).json({ error: "You cannot enter marks for this student" });
  }
  const pct = (obtainedMarks / maximumMarks) * 100;
  const grade = computeGrade(pct);

  try {
    const info = db
      .prepare(
        `INSERT INTO marks (student_id, subject_id, examination_id, maximum_marks, obtained_marks, grade, remarks, entered_by)
         VALUES (?,?,?,?,?,?,?,?)
         ON CONFLICT(student_id, subject_id, examination_id) DO UPDATE SET
           maximum_marks = excluded.maximum_marks,
           obtained_marks = excluded.obtained_marks,
           grade = excluded.grade,
           remarks = excluded.remarks,
           entered_by = excluded.entered_by`
      )
      .run(studentId, subjectId, examinationId, maximumMarks, obtainedMarks, grade, remarks || null, req.user.linked_teacher_id);
    res.status(201).json({ id: info.lastInsertRowid, grade, message: "Marks saved" });
  } catch (err) {
    res.status(500).json({ error: "Could not save marks" });
  }
});

router.put("/:id", requireRole("teacher"), (req, res) => {
  const mark = db.prepare("SELECT * FROM marks WHERE id = ?").get(req.params.id);
  if (!mark) return res.status(404).json({ error: "Mark not found" });
  if (!teacherCanGradeStudent(req.user.linked_teacher_id, mark.student_id)) {
    return res.status(403).json({ error: "You cannot edit marks for this student" });
  }
  const { obtainedMarks, maximumMarks, remarks } = req.body || {};
  const newMax = maximumMarks != null ? maximumMarks : mark.maximum_marks;
  const newObt = obtainedMarks != null ? obtainedMarks : mark.obtained_marks;
  const grade = computeGrade((newObt / newMax) * 100);
  db.prepare("UPDATE marks SET maximum_marks=?, obtained_marks=?, grade=?, remarks=? WHERE id=?")
    .run(newMax, newObt, grade, remarks != null ? remarks : mark.remarks, req.params.id);
  res.json({ message: "Marks updated", grade });
});

module.exports = router;
