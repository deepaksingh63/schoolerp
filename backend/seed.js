require("dotenv").config();
const bcrypt = require("bcryptjs");
const db = require("./models/db");

const SESSION = process.env.ACADEMIC_SESSION || "2026-27";

function reset() {
  const tables = [
    "marks", "attendance", "teacher_assignments", "notices",
    "examinations", "subjects", "parents", "users", "students", "teachers", "sections", "classes",
  ];
  for (const t of tables) db.prepare(`DELETE FROM ${t}`).run();
}

function run() {
  reset();
  console.log("Seeding SD Public School demo data...");

  // Classes & sections
  const classIX = db.prepare("INSERT INTO classes (class_name, academic_session) VALUES (?,?)").run("Class IX", SESSION).lastInsertRowid;
  const classX = db.prepare("INSERT INTO classes (class_name, academic_session) VALUES (?,?)").run("Class X", SESSION).lastInsertRowid;
  const sec = (classId, name) => db.prepare("INSERT INTO sections (class_id, section_name) VALUES (?,?)").run(classId, name).lastInsertRowid;
  const ix_a = sec(classIX, "A");
  const ix_b = sec(classIX, "B");
  const x_a = sec(classX, "A");
  const x_b = sec(classX, "B");

  // Subjects
  const subjectNames = ["Mathematics", "Science", "English", "Social Science", "Hindi"];
  const subjectIds = {};
  for (const s of subjectNames) subjectIds[s] = db.prepare("INSERT INTO subjects (name) VALUES (?)").run(s).lastInsertRowid;

  // Examinations
  const examPT = db.prepare("INSERT INTO examinations (name, academic_session, date) VALUES (?,?,?)").run("Periodic Test 1", SESSION, "2026-07-15").lastInsertRowid;
  const examHalf = db.prepare("INSERT INTO examinations (name, academic_session, date) VALUES (?,?,?)").run("Half Yearly", SESSION, "2026-09-20").lastInsertRowid;

  // Teachers
  const teacherDefs = [
    { reg: "TCH-1001", name: "Anjali Verma", qualification: "M.Sc. Mathematics, B.Ed.", mobile: "9876500001", email: "anjali.verma@sdpublicschool.edu", subject: "Mathematics" },
    { reg: "TCH-1002", name: "Rakesh Kumar Singh", qualification: "M.Sc. Physics, B.Ed.", mobile: "9876500002", email: "rakesh.singh@sdpublicschool.edu", subject: "Science" },
    { reg: "TCH-1003", name: "Priya Mishra", qualification: "M.A. English, B.Ed.", mobile: "9876500003", email: "priya.mishra@sdpublicschool.edu", subject: "English" },
    { reg: "TCH-1004", name: "Suresh Yadav", qualification: "M.A. History, B.Ed.", mobile: "9876500004", email: "suresh.yadav@sdpublicschool.edu", subject: "Social Science" },
    { reg: "TCH-1005", name: "Neha Tiwari", qualification: "M.A. Hindi, B.Ed.", mobile: "9876500005", email: "neha.tiwari@sdpublicschool.edu", subject: "Hindi" },
    { reg: "TCH-1006", name: "Vikram Chauhan", qualification: "M.Sc. Mathematics, B.Ed.", mobile: "9876500006", email: "vikram.chauhan@sdpublicschool.edu", subject: "Mathematics" },
  ];
  const teacherIds = {};
  for (const t of teacherDefs) {
    const id = db
      .prepare("INSERT INTO teachers (registration_number, teacher_code, name, qualification, mobile, email) VALUES (?,?,?,?,?,?)")
      .run(t.reg, "TCH-" + t.reg, t.name, t.qualification, t.mobile, t.email).lastInsertRowid;
    teacherIds[t.reg] = id;
  }

  // Assignments
  const assign = (regNo, classId, sectionId, subject) =>
    db.prepare("INSERT INTO teacher_assignments (teacher_id, class_id, section_id, subject) VALUES (?,?,?,?)")
      .run(teacherIds[regNo], classId, sectionId, subject);
  assign("TCH-1001", classIX, ix_a, "Mathematics");
  assign("TCH-1001", classIX, ix_b, "Mathematics");
  assign("TCH-1002", classIX, ix_a, "Science");
  assign("TCH-1003", classIX, ix_a, "English");
  assign("TCH-1004", classIX, ix_b, "Social Science");
  assign("TCH-1005", classX, x_a, "Hindi");
  assign("TCH-1006", classX, x_a, "Mathematics");
  assign("TCH-1006", classX, x_b, "Mathematics");

  // Students — 20+ across 2 classes / 4 sections
  const firstNames = ["Abhishek", "Priya", "Rohit", "Sneha", "Ankit", "Kavita", "Manish", "Pooja", "Saurabh", "Divya", "Amit", "Neha", "Rahul", "Shreya", "Vikash", "Anjali", "Deepak", "Ritu", "Gaurav", "Sonam", "Nitin", "Preeti"];
  const lastNames = ["Sharma", "Verma", "Singh", "Gupta", "Yadav", "Mishra", "Chauhan", "Tiwari", "Pandey", "Kumar"];
  const sectionsCycle = [ [classIX, ix_a, "IX-A"], [classIX, ix_b, "IX-B"], [classX, x_a, "X-A"], [classX, x_b, "X-B"] ];

  const students = [];
  let regCounter = 2001;
  for (let i = 0; i < 24; i++) {
    const [classId, sectionId, label] = sectionsCycle[i % sectionsCycle.length];
    const name = `${firstNames[i % firstNames.length]} ${lastNames[(i * 3) % lastNames.length]}`;
    const regNo = `STU-${regCounter++}`;
    const rollNumber = String((Math.floor(i / sectionsCycle.length)) + 1).padStart(2, "0");
    const id = db
      .prepare(
        `INSERT INTO students (registration_number, student_code, name, dob, gender, class_id, section_id, roll_number, admission_date)
         VALUES (?,?,?,?,?,?,?,?,?)`
      )
      .run(regNo, "STU-" + regNo, name, "2011-04-12", i % 2 === 0 ? "Male" : "Female", classId, sectionId, rollNumber, "2024-04-01").lastInsertRowid;
    db.prepare("INSERT INTO parents (student_id, father_name, mother_name, mobile, address) VALUES (?,?,?,?,?)")
      .run(id, `Mr. ${lastNames[i % lastNames.length]}`, `Mrs. ${lastNames[(i + 2) % lastNames.length]}`, `98765${String(10000 + i).slice(-5)}`, "Kushinagar, Uttar Pradesh");
    students.push({ id, regNo, name, classId, sectionId, label });
  }

  // Attendance — last 15 working days for every student, mostly present
  const today = new Date();
  for (let d = 15; d >= 1; d--) {
    const day = new Date(today);
    day.setDate(day.getDate() - d);
    if (day.getDay() === 0) continue; // skip Sundays
    const dateStr = day.toISOString().slice(0, 10);
    for (const s of students) {
      const status = Math.random() < 0.9 ? "present" : "absent";
      const teacherForClass = Object.entries(teacherIds).find(([reg]) => true);
      db.prepare("INSERT OR IGNORE INTO attendance (student_id, date, status, marked_by) VALUES (?,?,?,?)")
        .run(s.id, dateStr, status, teacherIds["TCH-1001"]);
    }
  }

  // Marks — Periodic Test 1 for Mathematics & English for a handful of students
  for (const s of students.slice(0, 10)) {
    const obtainedMath = 60 + Math.floor(Math.random() * 35);
    const obtainedEng = 55 + Math.floor(Math.random() * 40);
    const grade = (pct) => (pct >= 90 ? "A+" : pct >= 80 ? "A" : pct >= 70 ? "B+" : pct >= 60 ? "B" : "C");
    db.prepare("INSERT INTO marks (student_id, subject_id, examination_id, maximum_marks, obtained_marks, grade, remarks, entered_by) VALUES (?,?,?,?,?,?,?,?)")
      .run(s.id, subjectIds["Mathematics"], examPT, 100, obtainedMath, grade(obtainedMath), "Good effort, keep practicing.", teacherIds["TCH-1001"]);
    db.prepare("INSERT INTO marks (student_id, subject_id, examination_id, maximum_marks, obtained_marks, grade, remarks, entered_by) VALUES (?,?,?,?,?,?,?,?)")
      .run(s.id, subjectIds["English"], examPT, 100, obtainedEng, grade(obtainedEng), "Well written answers.", teacherIds["TCH-1003"]);
  }

  // Notices
  const noticeDefs = [
    { title: "Half Yearly Examination Datesheet Released", description: "The datesheet for the Half Yearly Examinations has been published. Students are advised to check the notice board and prepare accordingly.", category: "Examination" },
    { title: "Independence Day Celebration", description: "SD Public School will celebrate Independence Day on 15th August. All students must report in full school uniform by 8:00 AM.", category: "General" },
    { title: "Parent-Teacher Meeting", description: "A Parent-Teacher Meeting for Classes IX and X will be held this Saturday to discuss student progress.", category: "Important" },
    { title: "Science Exhibition Registrations Open", description: "Students interested in participating in the Annual Science Exhibition may register with their class teacher by end of this week.", category: "Academic" },
  ];

  // Demo login accounts (per spec section 26)
  const adminUserId = db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?,?,?)")
    .run("admin", bcrypt.hashSync("Admin@123", 10), "admin").lastInsertRowid;

  for (const n of noticeDefs) {
    db.prepare("INSERT INTO notices (title, description, category, published_by, status) VALUES (?,?,?,?,?)")
      .run(n.title, n.description, n.category, adminUserId, "published");
  }

  // Demo teacher account -> claims TCH-1001 (Anjali Verma)
  db.prepare("INSERT INTO users (username, password_hash, role, linked_teacher_id) VALUES (?,?,?,?)")
    .run("teacher", bcrypt.hashSync("Teacher@123", 10), "teacher", teacherIds["TCH-1001"]);
  db.prepare("UPDATE teachers SET claimed = 1 WHERE id = ?").run(teacherIds["TCH-1001"]);

  // Demo student account -> claims the first seeded student
  const demoStudent = students[0];
  db.prepare("INSERT INTO users (username, password_hash, role, linked_student_id) VALUES (?,?,?,?)")
    .run("student", bcrypt.hashSync("Student@123", 10), "student", demoStudent.id);
  db.prepare("UPDATE students SET claimed = 1 WHERE id = ?").run(demoStudent.id);

  // Demo parent account -> linked to the same first student (parents don't "claim" a slot, a student can have one parent account)
  db.prepare("INSERT INTO users (username, password_hash, role, linked_student_id) VALUES (?,?,?,?)")
    .run("parent", bcrypt.hashSync("Parent@123", 10), "parent", demoStudent.id);

  console.log("Seed complete.");
  console.log("");
  console.log("Demo login accounts:");
  console.log("  ADMIN    username: admin    password: Admin@123");
  console.log("  TEACHER  username: teacher  password: Teacher@123");
  console.log("  STUDENT  username: student  password: Student@123");
  console.log("  PARENT   username: parent   password: Parent@123");
  console.log("");
  console.log("Unclaimed registration numbers you can use to test the NEW signup page:");
  console.log("  Teacher (unclaimed): TCH-1002, TCH-1003, TCH-1004, TCH-1005, TCH-1006");
  console.log(`  Student (unclaimed): ${students.slice(1, 4).map((s) => s.regNo).join(", ")}`);
  console.log(`  Parent  (any student's reg. no. works, e.g.): ${students[1].regNo}`);
}

run();
