const express = require("express");
const db = require("../models/db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/", (req, res) => {
  const today = new Date().toISOString().slice(0, 10);

  if (req.user.role === "admin") {
    const totalStudents = db.prepare("SELECT COUNT(*) c FROM students WHERE status='active'").get().c;
    const totalTeachers = db.prepare("SELECT COUNT(*) c FROM teachers WHERE status='active'").get().c;
    const totalClasses = db.prepare("SELECT COUNT(*) c FROM classes").get().c;
    const todayPresent = db.prepare("SELECT COUNT(*) c FROM attendance WHERE date=? AND status='present'").get(today).c;
    const todayMarked = db.prepare("SELECT COUNT(*) c FROM attendance WHERE date=?").get(today).c;
    const lowAttendance = db
      .prepare(
        `SELECT s.id, s.name,
           ROUND(100.0 * SUM(CASE WHEN a.status='present' THEN 1 ELSE 0 END) / COUNT(a.id), 1) as pct
         FROM students s JOIN attendance a ON a.student_id = s.id
         GROUP BY s.id HAVING COUNT(a.id) >= 5 AND pct < 75
         ORDER BY pct ASC LIMIT 10`
      )
      .all();
    const recentNotices = db.prepare("SELECT * FROM notices WHERE status='published' ORDER BY published_at DESC LIMIT 5").all();
    return res.json({
      totalStudents, totalTeachers, totalClasses,
      todayAttendance: { marked: todayMarked, present: todayPresent },
      lowAttendanceStudents: lowAttendance,
      recentNotices,
    });
  }

  if (req.user.role === "teacher") {
    const assignments = db
      .prepare(
        `SELECT ta.*, c.class_name, sec.section_name FROM teacher_assignments ta
         JOIN classes c ON c.id = ta.class_id JOIN sections sec ON sec.id = ta.section_id
         WHERE ta.teacher_id = ?`
      )
      .all(req.user.linked_teacher_id);
    const pairs = [...new Map(assignments.map((a) => [`${a.class_id}-${a.section_id}`, a])).values()];
    let totalStudents = 0;
    for (const p of pairs) {
      totalStudents += db
        .prepare("SELECT COUNT(*) c FROM students WHERE class_id=? AND section_id=? AND status='active'")
        .get(p.class_id, p.section_id).c;
    }
    const todayMarked = db
      .prepare("SELECT COUNT(*) c FROM attendance WHERE date=? AND marked_by=?")
      .get(today, req.user.linked_teacher_id).c;
    const recentNotices = db.prepare("SELECT * FROM notices WHERE status='published' ORDER BY published_at DESC LIMIT 5").all();
    return res.json({ assignedClasses: pairs, totalStudents, todayAttendanceMarked: todayMarked, recentNotices });
  }

  // student / parent
  const studentId = req.user.linked_student_id;
  const student = db
    .prepare(
      `SELECT s.*, c.class_name, sec.section_name FROM students s
       LEFT JOIN classes c ON c.id = s.class_id LEFT JOIN sections sec ON sec.id = s.section_id
       WHERE s.id = ?`
    )
    .get(studentId);
  const attendance = db
    .prepare(
      `SELECT ROUND(100.0 * SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) / COUNT(*), 1) as pct, COUNT(*) as total
       FROM attendance WHERE student_id = ?`
    )
    .get(studentId);
  const marks = db
    .prepare(
      `SELECT sub.name as subject, ex.name as examination, m.obtained_marks, m.maximum_marks, m.grade
       FROM marks m JOIN subjects sub ON sub.id=m.subject_id JOIN examinations ex ON ex.id=m.examination_id
       WHERE m.student_id = ? ORDER BY ex.date DESC LIMIT 5`
    )
    .all(studentId);
  const recentNotices = db.prepare("SELECT * FROM notices WHERE status='published' ORDER BY published_at DESC LIMIT 5").all();
  res.json({ student, attendance, recentMarks: marks, recentNotices });
});

module.exports = router;
