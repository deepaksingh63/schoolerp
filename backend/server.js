require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/auth");
const studentRoutes = require("./routes/students");
const teacherRoutes = require("./routes/teachers");
const classRoutes = require("./routes/classes");
const attendanceRoutes = require("./routes/attendance");
const marksRoutes = require("./routes/marks");
const noticeRoutes = require("./routes/notices");
const userRoutes = require("./routes/users");
const academicRoutes = require("./routes/academics");
const dashboardRoutes = require("./routes/dashboard");

const app = express();
app.use(cors());
app.use(express.json());

// Serve the frontend (plain HTML/CSS/JS) as static files
app.use(express.static(path.join(__dirname, "..", "frontend", "public")));

app.get("/api/health", (req, res) => res.json({ status: "ok", school: process.env.SCHOOL_NAME || "SD Public School" }));

app.use("/api/auth", authRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/classes", classRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/marks", marksRoutes);
app.use("/api/notices", noticeRoutes);
app.use("/api/users", userRoutes);
app.use("/api/academics", academicRoutes);
app.use("/api/dashboard", dashboardRoutes);

// Central error handler — never leak stack traces to the client
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

app.use((req, res) => res.status(404).json({ error: "Not found" }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`SD Public School backend running on http://localhost:${PORT}`);
});
