const express = require("express");
const db = require("../models/db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

function teacherClassSectionIds(teacherId) {
  const rows = db
    .prepare("SELECT DISTINCT class_id, section_id FROM teacher_assignments WHERE teacher_id = ?")
    .all(teacherId);
  return rows;
}

// GET /api/students  (admin: all, filterable | teacher: only assigned classes | student/parent: only self)
router.get("/", (req, res) => {
  const { classId, sectionId, search } = req.query;

  if (req.user.role === "admin") {
    let sql = `SELECT s.*, c.class_name, sec.section_name FROM students s
                LEFT JOIN classes c ON c.id = s.class_id
                LEFT JOIN sections sec ON sec.id = s.section_id WHERE 1=1`;
    const params = [];
    if (classId) { sql += " AND s.class_id = ?"; params.push(classId); }
    if (sectionId) { sql += " AND s.section_id = ?"; params.push(sectionId); }
    if (search) { sql += " AND (s.name LIKE ? OR s.registration_number LIKE ? OR s.student_code LIKE ?)"; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    sql += " ORDER BY s.name";
    return res.json(db.prepare(sql).all(...params));
  }

  if (req.user.role === "teacher") {
    const pairs = teacherClassSectionIds(req.user.linked_teacher_id);
    if (pairs.length === 0) return res.json([]);
    const clause = pairs.map(() => "(s.class_id = ? AND s.section_id = ?)").join(" OR ");
    const params = pairs.flatMap((p) => [p.class_id, p.section_id]);
    let sql = `SELECT s.*, c.class_name, sec.section_name FROM students s
               LEFT JOIN classes c ON c.id = s.class_id
               LEFT JOIN sections sec ON sec.id = s.section_id
               WHERE (${clause})`;
    if (search) { sql += " AND (s.name LIKE ? OR s.registration_number LIKE ?)"; params.push(`%${search}%`, `%${search}%`); }
    sql += " ORDER BY s.name";
    return res.json(db.prepare(sql).all(...params));
  }

  // student / parent -> only their own record
  if (!req.user.linked_student_id) return res.json([]);
  const own = db
    .prepare(
      `SELECT s.*, c.class_name, sec.section_name FROM students s
       LEFT JOIN classes c ON c.id = s.class_id
       LEFT JOIN sections sec ON sec.id = s.section_id
       WHERE s.id = ?`
    )
    .get(req.user.linked_student_id);
  return res.json(own ? [own] : []);
});

// helper: can the requesting user view this specific student id?
function canAccessStudent(req, studentId) {
  if (req.user.role === "admin") return true;
  if (req.user.role === "teacher") {
    const pairs = teacherClassSectionIds(req.user.linked_teacher_id);
    const student = db.prepare("SELECT class_id, section_id FROM students WHERE id = ?").get(studentId);
    if (!student) return false;
    return pairs.some((p) => p.class_id === student.class_id && p.section_id === student.section_id);
  }
  // student / parent — the request MUST match their own linked student, never trust the :id in the URL alone
  return req.user.linked_student_id === Number(studentId);
}

router.get("/:id", (req, res) => {
  if (!canAccessStudent(req, req.params.id)) {
    return res.status(403).json({ error: "You cannot access this student's data" });
  }
  const student = db
    .prepare(
      `SELECT s.*, c.class_name, sec.section_name FROM students s
       LEFT JOIN classes c ON c.id = s.class_id
       LEFT JOIN sections sec ON sec.id = s.section_id
       WHERE s.id = ?`
    )
    .get(req.params.id);
  if (!student) return res.status(404).json({ error: "Student not found" });

  const parent = db.prepare("SELECT * FROM parents WHERE student_id = ?").get(student.id);
  const attendance = db.prepare("SELECT status, COUNT(*) c FROM attendance WHERE student_id = ? GROUP BY status").all(student.id);
  res.json({ student, parent, attendance });
});

// POST /api/students  (admin only) — creates the pre-enrollment record + unique registration number
router.post("/", requireRole("admin"), (req, res) => {
  const { registrationNumber, name, dob, gender, classId, sectionId, rollNumber, admissionDate, photo, father_name, mother_name, mobile, address } = req.body || {};
  if (!registrationNumber || !name) {
    return res.status(400).json({ error: "registrationNumber and name are required" });
  }
  const studentCode = "STU-" + registrationNumber;
  try {
    const tx = db.transaction(() => {
      const info = db
        .prepare(
          `INSERT INTO students (registration_number, student_code, name, photo, dob, gender, class_id, section_id, roll_number, admission_date)
           VALUES (?,?,?,?,?,?,?,?,?,?)`
        )
        .run(registrationNumber, studentCode, name, photo || null, dob || null, gender || null, classId || null, sectionId || null, rollNumber || null, admissionDate || null);
      if (father_name || mother_name || mobile || address) {
        db.prepare(
          "INSERT INTO parents (student_id, father_name, mother_name, mobile, address) VALUES (?,?,?,?,?)"
        ).run(info.lastInsertRowid, father_name || null, mother_name || null, mobile || null, address || null);
      }
      return info.lastInsertRowid;
    });
    const id = tx();
    res.status(201).json({ id, message: "Student created" });
  } catch (err) {
    if (String(err.message).includes("UNIQUE")) {
      return res.status(409).json({ error: "That registration number is already in use" });
    }
    res.status(500).json({ error: "Could not create student" });
  }
});

router.put("/:id", requireRole("admin"), (req, res) => {
  const fields = ["name", "dob", "gender", "class_id", "section_id", "roll_number", "admission_date", "status", "photo"];
  const body = req.body || {};
  const sets = [];
  const params = [];
  for (const f of fields) {
    const camel = f.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    if (body[camel] !== undefined || body[f] !== undefined) {
      sets.push(`${f} = ?`);
      params.push(body[camel] !== undefined ? body[camel] : body[f]);
    }
  }
  if (sets.length === 0) return res.status(400).json({ error: "Nothing to update" });
  params.push(req.params.id);
  db.prepare(`UPDATE students SET ${sets.join(", ")} WHERE id = ?`).run(...params);
  res.json({ message: "Student updated" });
});

router.delete("/:id", requireRole("admin"), (req, res) => {
  db.prepare("UPDATE students SET status = 'inactive' WHERE id = ?").run(req.params.id);
  res.json({ message: "Student deactivated" });
});

module.exports = router;
