const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../models/db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      linked_student_id: user.linked_student_id || null,
      linked_teacher_id: user.linked_teacher_id || null,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
  );
}

/**
 * POST /api/auth/signup
 * Self-registration for teacher / student / parent.
 * Every signup MUST include the person's unique "School Registration Number"
 * (issued by the admin when the student/teacher record was created).
 * This proves the person is a genuine, pre-enrolled member of the school
 * before they can create a login — it is validated and matched server-side,
 * never trusted blindly from the form.
 *
 * body: { role, registrationNumber, username, password }
 *   role: 'teacher' | 'student' | 'parent'
 *   registrationNumber:
 *     - teacher signup -> the teacher's own registration number
 *     - student signup -> the student's own registration number
 *     - parent signup  -> the CHILD's (student's) registration number
 */
router.post("/signup", (req, res) => {
  const { role, registrationNumber, username, password } = req.body || {};

  if (!role || !["teacher", "student", "parent"].includes(role)) {
    return res.status(400).json({ error: "role must be teacher, student, or parent" });
  }
  if (!registrationNumber || !registrationNumber.trim()) {
    return res.status(400).json({ error: "School registration number is required" });
  }
  if (!username || username.trim().length < 4) {
    return res.status(400).json({ error: "Username must be at least 4 characters" });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  const existingUser = db.prepare("SELECT id FROM users WHERE username = ?").get(username.trim());
  if (existingUser) {
    return res.status(409).json({ error: "That username is already taken" });
  }

  const regNo = registrationNumber.trim();
  const passwordHash = bcrypt.hashSync(password, 10);

  try {
    if (role === "teacher") {
      const teacher = db.prepare("SELECT * FROM teachers WHERE registration_number = ?").get(regNo);
      if (!teacher) {
        return res.status(404).json({ error: "No teacher record found for that registration number" });
      }
      if (teacher.claimed) {
        return res.status(409).json({ error: "An account already exists for this registration number" });
      }

      const tx = db.transaction(() => {
        const info = db
          .prepare(
            "INSERT INTO users (username, password_hash, role, linked_teacher_id) VALUES (?, ?, 'teacher', ?)"
          )
          .run(username.trim(), passwordHash, teacher.id);
        db.prepare("UPDATE teachers SET claimed = 1 WHERE id = ?").run(teacher.id);
        return info.lastInsertRowid;
      });
      const userId = tx();
      return res.status(201).json({ message: "Teacher account created", userId });
    }

    if (role === "student") {
      const student = db.prepare("SELECT * FROM students WHERE registration_number = ?").get(regNo);
      if (!student) {
        return res.status(404).json({ error: "No student record found for that registration number" });
      }
      if (student.claimed) {
        return res.status(409).json({ error: "An account already exists for this registration number" });
      }

      const tx = db.transaction(() => {
        const info = db
          .prepare(
            "INSERT INTO users (username, password_hash, role, linked_student_id) VALUES (?, ?, 'student', ?)"
          )
          .run(username.trim(), passwordHash, student.id);
        db.prepare("UPDATE students SET claimed = 1 WHERE id = ?").run(student.id);
        return info.lastInsertRowid;
      });
      const userId = tx();
      return res.status(201).json({ message: "Student account created", userId });
    }

    if (role === "parent") {
      // Parent signs up using the CHILD's registration number.
      const student = db.prepare("SELECT * FROM students WHERE registration_number = ?").get(regNo);
      if (!student) {
        return res.status(404).json({ error: "No student found for that registration number" });
      }
      const existingParentUser = db
        .prepare(
          `SELECT u.id FROM users u
           JOIN parents p ON p.student_id = u.linked_student_id
           WHERE u.role = 'parent' AND u.linked_student_id = ?`
        )
        .get(student.id);
      if (existingParentUser) {
        return res.status(409).json({ error: "A parent account already exists for this student" });
      }

      const info = db
        .prepare(
          "INSERT INTO users (username, password_hash, role, linked_student_id) VALUES (?, ?, 'parent', ?)"
        )
        .run(username.trim(), passwordHash, student.id);
      return res.status(201).json({ message: "Parent account created", userId: info.lastInsertRowid });
    }
  } catch (err) {
    console.error("Signup error:", err.message);
    return res.status(500).json({ error: "Could not create account, please try again" });
  }
});

router.post("/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username.trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Invalid username or password" });
  }
  if (user.status !== "active") {
    return res.status(403).json({ error: "This account has been deactivated. Contact the school admin." });
  }

  const token = signToken(user);
  return res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
  });
});

router.post("/logout", (req, res) => {
  // Stateless JWT — logout is handled client-side by discarding the token.
  return res.json({ message: "Logged out" });
});

router.get("/me", requireAuth, (req, res) => {
  const user = db.prepare("SELECT id, username, role, status FROM users WHERE id = ?").get(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  let profile = null;
  if (user.role === "teacher" || req.user.linked_teacher_id) {
    profile = db.prepare("SELECT * FROM teachers WHERE id = ?").get(req.user.linked_teacher_id);
  } else if (["student", "parent"].includes(user.role) || req.user.linked_student_id) {
    profile = db.prepare("SELECT * FROM students WHERE id = ?").get(req.user.linked_student_id);
  }

  res.json({ user, profile });
});

module.exports = router;
