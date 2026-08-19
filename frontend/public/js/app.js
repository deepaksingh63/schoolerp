requireLogin();

let ME = null; // { user, profile }

const NAV = {
  admin: [
    ["dashboard", "📊 Dashboard"],
    ["students", "🎒 Students"],
    ["teachers", "🧑‍🏫 Teachers"],
    ["classes", "🏫 Classes & Sections"],
    ["attendance", "🗓️ Attendance Overview"],
    ["academics", "📘 Academic Overview"],
    ["notices", "📣 Notices"],
    ["users", "👤 User Management"],
    ["profile", "⚙️ Admin Profile"],
  ],
  teacher: [
    ["dashboard", "📊 Dashboard"],
    ["students", "🎒 My Students"],
    ["attendance", "🗓️ Mark Attendance"],
    ["academics", "📘 Enter Marks"],
    ["notices", "📣 Notices"],
    ["profile", "⚙️ My Profile"],
  ],
  student: [
    ["dashboard", "📊 Dashboard"],
    ["profile", "🧑 My Profile"],
    ["attendance", "🗓️ My Attendance"],
    ["academics", "📘 My Performance"],
    ["notices", "📣 Notices"],
  ],
  parent: [
    ["dashboard", "📊 Dashboard"],
    ["profile", "🧑 Student Profile"],
    ["attendance", "🗓️ Attendance"],
    ["academics", "📘 Academic Performance"],
    ["notices", "📣 Notices"],
  ],
};

const TITLES = {
  dashboard: "Dashboard", students: "Students", teachers: "Teachers", classes: "Classes & Sections",
  attendance: "Attendance", academics: "Academic Records", notices: "Notices", users: "User Management", profile: "Profile",
};

async function boot() {
  try {
    ME = await api("/auth/me");
  } catch (e) {
    return; // api() already redirects to login on 401
  }
  document.getElementById("whoBox").textContent =
    `${ME.user.username} · ${ME.user.role.charAt(0).toUpperCase() + ME.user.role.slice(1)}`;
  renderNav();
  window.addEventListener("hashchange", route);
  if (!location.hash) location.hash = "#dashboard";
  route();
}

function renderNav() {
  const links = NAV[ME.user.role] || [];
  document.getElementById("navLinks").innerHTML = links
    .map(([key, label]) => `<a href="#${key}" data-key="${key}">${label}</a>`)
    .join("");
}

function setActiveNav(key) {
  document.querySelectorAll("#navLinks a").forEach((a) => a.classList.toggle("active", a.dataset.key === key));
  document.getElementById("pageTitle").textContent = TITLES[key] || "Dashboard";
  document.getElementById("sidebar").classList.remove("open");
}

async function route() {
  const key = (location.hash || "#dashboard").slice(1);
  setActiveNav(key);
  const content = document.getElementById("content");
  content.innerHTML = `<div class="empty-state">Loading...</div>`;
  try {
    const renderers = {
      dashboard: renderDashboard, students: renderStudents, teachers: renderTeachers,
      classes: renderClasses, attendance: renderAttendance, academics: renderAcademics,
      notices: renderNotices, users: renderUsers, profile: renderProfile,
    };
    const fn = renderers[key] || renderDashboard;
    await fn(content);
  } catch (err) {
    content.innerHTML = `<div class="alert error">${escapeHtml(err.message)}</div>`;
  }
}

/* ---------------- DASHBOARD ---------------- */
async function renderDashboard(content) {
  const d = await api("/dashboard");
  const role = ME.user.role;

  if (role === "admin") {
    content.innerHTML = `
      <div class="grid cols-4">
        ${statCard("Total Students", d.totalStudents, "🎒")}
        ${statCard("Total Teachers", d.totalTeachers, "🧑‍🏫")}
        ${statCard("Total Classes", d.totalClasses, "🏫")}
        ${statCard("Today's Attendance", `${d.todayAttendance.present}/${d.todayAttendance.marked}`, "🗓️", "marked so far")}
      </div>
      <div class="grid cols-2" style="margin-top:16px">
        <div class="card">
          <h3>Students with Low Attendance</h3>
          <div class="table-wrap">
            ${d.lowAttendanceStudents.length ? `<table><thead><tr><th>Student</th><th>Attendance %</th></tr></thead><tbody>
              ${d.lowAttendanceStudents.map((s) => `<tr><td data-label="Student">${escapeHtml(s.name)}</td><td data-label="Attendance %">${s.pct}%</td></tr>`).join("")}
            </tbody></table>` : emptyState("✅", "No students below 75% attendance right now.")}
          </div>
        </div>
        <div class="card">
          <h3>Recent Notices</h3>
          ${renderNoticeMiniList(d.recentNotices)}
        </div>
      </div>`;
    return;
  }

  if (role === "teacher") {
    content.innerHTML = `
      <div class="grid cols-3">
        ${statCard("Assigned Classes", d.assignedClasses.length, "🏫")}
        ${statCard("Total Students", d.totalStudents, "🎒")}
        ${statCard("Attendance Marked Today", d.todayAttendanceMarked, "🗓️")}
      </div>
      <div class="grid cols-2" style="margin-top:16px">
        <div class="card">
          <h3>My Assigned Classes</h3>
          <div class="table-wrap"><table><thead><tr><th>Class</th><th>Section</th><th>Subject</th></tr></thead><tbody>
          ${d.assignedClasses.map((a) => `<tr><td data-label="Class">${escapeHtml(a.class_name)}</td><td data-label="Section">${escapeHtml(a.section_name)}</td><td data-label="Subject">${escapeHtml(a.subject)}</td></tr>`).join("") || `<tr><td colspan="3">No assignments yet.</td></tr>`}
          </tbody></table></div>
        </div>
        <div class="card"><h3>Recent Notices</h3>${renderNoticeMiniList(d.recentNotices)}</div>
      </div>`;
    return;
  }

  // student / parent
  const s = d.student || {};
  content.innerHTML = `
    <div class="grid cols-3">
      ${statCard("Class", s.class_name ? `${s.class_name} - ${s.section_name}` : "-", "🏫")}
      ${statCard("Roll Number", s.roll_number || "-", "🎒")}
      ${statCard("Attendance", d.attendance.pct != null ? d.attendance.pct + "%" : "No data", "🗓️")}
    </div>
    <div class="grid cols-2" style="margin-top:16px">
      <div class="card">
        <h3>Recent Academic Performance</h3>
        <div class="table-wrap"><table><thead><tr><th>Subject</th><th>Exam</th><th>Marks</th><th>Grade</th></tr></thead><tbody>
        ${(d.recentMarks || []).map((m) => `<tr><td data-label="Subject">${escapeHtml(m.subject)}</td><td data-label="Exam">${escapeHtml(m.examination)}</td><td data-label="Marks">${m.obtained_marks}/${m.maximum_marks}</td><td data-label="Grade">${escapeHtml(m.grade || "-")}</td></tr>`).join("") || `<tr><td colspan="4">No records yet.</td></tr>`}
        </tbody></table></div>
      </div>
      <div class="card"><h3>Recent Notices</h3>${renderNoticeMiniList(d.recentNotices)}</div>
    </div>`;
}

function statCard(label, value, icon, sub) {
  return `<div class="card stat-card"><div class="label">${icon} ${label}</div><div class="value">${value}</div>${sub ? `<div class="sub">${sub}</div>` : ""}</div>`;
}
function emptyState(icon, text) {
  return `<div class="empty-state"><div class="icon">${icon}</div><p>${text}</p></div>`;
}
function renderNoticeMiniList(notices) {
  if (!notices || !notices.length) return emptyState("📭", "No notices published yet.");
  return notices.map((n) => `
    <div style="padding:10px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;gap:8px">
        <strong style="font-size:13.5px">${escapeHtml(n.title)}</strong>
        <span class="badge cat-${n.category}">${n.category}</span>
      </div>
      <div style="font-size:12.5px;color:var(--muted);margin-top:4px">${escapeHtml((n.description || "").slice(0, 90))}${n.description && n.description.length > 90 ? "…" : ""}</div>
    </div>`).join("");
}

/* ---------------- STUDENTS ---------------- */
async function renderStudents(content) {
  const canManage = ME.user.role === "admin";
  const classes = await api("/classes");

  content.innerHTML = `
    <div class="toolbar">
      <input type="text" id="stuSearch" placeholder="Search by name or registration number...">
      <select id="stuClassFilter"><option value="">All Classes</option>${classes.map((c) => `<option value="${c.id}">${escapeHtml(c.class_name)}</option>`).join("")}</select>
      ${canManage ? `<button class="btn small" style="margin-left:auto" onclick="openAddStudentModal()">+ Add Student</button>` : ""}
    </div>
    <div class="card"><div class="table-wrap" id="studentsTableWrap">Loading...</div></div>
    <div id="modalRoot"></div>`;

  async function load() {
    const search = document.getElementById("stuSearch").value.trim();
    const classId = document.getElementById("stuClassFilter").value;
    const qs = new URLSearchParams();
    if (search) qs.set("search", search);
    if (classId) qs.set("classId", classId);
    const students = await api("/students?" + qs.toString());
    document.getElementById("studentsTableWrap").innerHTML = students.length ? `
      <table><thead><tr><th>Reg. No.</th><th>Name</th><th>Class</th><th>Section</th><th>Roll No.</th><th>Status</th><th></th></tr></thead>
      <tbody>${students.map((s) => `
        <tr>
          <td data-label="Reg. No.">${escapeHtml(s.registration_number)}</td>
          <td data-label="Name">${escapeHtml(s.name)}</td>
          <td data-label="Class">${escapeHtml(s.class_name || "-")}</td>
          <td data-label="Section">${escapeHtml(s.section_name || "-")}</td>
          <td data-label="Roll No.">${escapeHtml(s.roll_number || "-")}</td>
          <td data-label="Status"><span class="badge ${s.status}">${s.status}</span></td>
          <td data-label=""><button class="btn secondary small" onclick="viewStudent(${s.id})">View</button></td>
        </tr>`).join("")}</tbody></table>` : emptyState("🎒", "No students found.");
  }

  document.getElementById("stuSearch").addEventListener("input", debounce(load, 300));
  document.getElementById("stuClassFilter").addEventListener("change", load);
  await load();
}

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

async function viewStudent(id) {
  const data = await api(`/students/${id}`);
  const s = data.student, p = data.parent || {};
  const modalRoot = document.getElementById("modalRoot") || document.body;
  modalRoot.innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this) this.remove()">
      <div class="modal">
        <h3>${escapeHtml(s.name)}</h3>
        <p style="color:var(--muted);font-size:13px;margin-bottom:14px">Reg. No: ${escapeHtml(s.registration_number)}</p>
        <div class="grid cols-2">
          <div><strong style="font-size:12.5px;color:var(--muted)">CLASS</strong><p>${escapeHtml(s.class_name || "-")} - ${escapeHtml(s.section_name || "-")}</p></div>
          <div><strong style="font-size:12.5px;color:var(--muted)">ROLL NO.</strong><p>${escapeHtml(s.roll_number || "-")}</p></div>
          <div><strong style="font-size:12.5px;color:var(--muted)">DOB</strong><p>${escapeHtml(s.dob || "-")}</p></div>
          <div><strong style="font-size:12.5px;color:var(--muted)">GENDER</strong><p>${escapeHtml(s.gender || "-")}</p></div>
          <div><strong style="font-size:12.5px;color:var(--muted)">FATHER/GUARDIAN</strong><p>${escapeHtml(p.father_name || "-")}</p></div>
          <div><strong style="font-size:12.5px;color:var(--muted)">MOTHER</strong><p>${escapeHtml(p.mother_name || "-")}</p></div>
          <div><strong style="font-size:12.5px;color:var(--muted)">PARENT MOBILE</strong><p>${escapeHtml(p.mobile || "-")}</p></div>
          <div><strong style="font-size:12.5px;color:var(--muted)">ADDRESS</strong><p>${escapeHtml(p.address || "-")}</p></div>
        </div>
        <div class="form-actions"><button class="btn secondary" onclick="this.closest('.modal-overlay').remove()">Close</button></div>
      </div>
    </div>`;
}

async function openAddStudentModal() {
  const classes = await api("/classes");
  const modalRoot = document.getElementById("modalRoot");
  modalRoot.innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this) this.remove()">
      <div class="modal">
        <h3>Add Student</h3>
        <form id="addStudentForm">
          <div class="field"><label>School Registration Number (unique)</label><input required id="asReg" placeholder="e.g. STU-3001"></div>
          <div class="field"><label>Full Name</label><input required id="asName"></div>
          <div class="grid cols-2">
            <div class="field"><label>Class</label><select id="asClass"><option value="">Select</option>${classes.map((c) => `<option value="${c.id}">${escapeHtml(c.class_name)}</option>`).join("")}</select></div>
            <div class="field"><label>Section</label><select id="asSection"><option value="">Select class first</option></select></div>
          </div>
          <div class="grid cols-2">
            <div class="field"><label>Roll Number</label><input id="asRoll"></div>
            <div class="field"><label>Date of Birth</label><input type="date" id="asDob"></div>
          </div>
          <div class="grid cols-2">
            <div class="field"><label>Gender</label><select id="asGender"><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></select></div>
            <div class="field"><label>Admission Date</label><input type="date" id="asAdmission"></div>
          </div>
          <div class="field"><label>Father/Guardian Name</label><input id="asFather"></div>
          <div class="field"><label>Mother's Name</label><input id="asMother"></div>
          <div class="field"><label>Parent Mobile Number</label><input id="asMobile"></div>
          <div class="field"><label>Address</label><input id="asAddress"></div>
          <div id="asAlert"></div>
          <div class="form-actions">
            <button type="button" class="btn secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
            <button type="submit" class="btn">Save Student</button>
          </div>
        </form>
      </div>
    </div>`;

  const classData = classes;
  document.getElementById("asClass").addEventListener("change", (e) => {
    const c = classData.find((c) => String(c.id) === e.target.value);
    document.getElementById("asSection").innerHTML = c ? c.sections.map((s) => `<option value="${s.id}">${escapeHtml(s.section_name)}</option>`).join("") : `<option value="">Select class first</option>`;
  });

  document.getElementById("addStudentForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const alertBox = document.getElementById("asAlert");
    try {
      await api("/students", { method: "POST", body: {
        registrationNumber: document.getElementById("asReg").value.trim(),
        name: document.getElementById("asName").value.trim(),
        classId: document.getElementById("asClass").value || null,
        sectionId: document.getElementById("asSection").value || null,
        rollNumber: document.getElementById("asRoll").value || null,
        dob: document.getElementById("asDob").value || null,
        gender: document.getElementById("asGender").value || null,
        admissionDate: document.getElementById("asAdmission").value || null,
        father_name: document.getElementById("asFather").value || null,
        mother_name: document.getElementById("asMother").value || null,
        mobile: document.getElementById("asMobile").value || null,
        address: document.getElementById("asAddress").value || null,
      }});
      document.querySelector(".modal-overlay").remove();
      showToast("Student added successfully");
      route();
    } catch (err) {
      alertBox.innerHTML = `<div class="alert error">${escapeHtml(err.message)}</div>`;
    }
  });
}

/* ---------------- TEACHERS (admin only) ---------------- */
async function renderTeachers(content) {
  if (ME.user.role !== "admin") { content.innerHTML = emptyState("🚫", "You don't have access to this page."); return; }
  const teachers = await api("/teachers");
  content.innerHTML = `
    <div class="toolbar"><button class="btn small" style="margin-left:auto" onclick="openAddTeacherModal()">+ Add Teacher</button></div>
    <div class="card"><div class="table-wrap">
      ${teachers.length ? `<table><thead><tr><th>Reg. No.</th><th>Name</th><th>Qualification</th><th>Mobile</th><th>Status</th><th></th></tr></thead>
      <tbody>${teachers.map((t) => `<tr>
        <td data-label="Reg. No.">${escapeHtml(t.registration_number)}</td>
        <td data-label="Name">${escapeHtml(t.name)}</td>
        <td data-label="Qualification">${escapeHtml(t.qualification || "-")}</td>
        <td data-label="Mobile">${escapeHtml(t.mobile || "-")}</td>
        <td data-label="Status"><span class="badge ${t.status}">${t.status}</span></td>
        <td data-label=""><button class="btn secondary small" onclick="openAssignModal(${t.id}, '${escapeHtml(t.name)}')">Assign Class</button></td>
      </tr>`).join("")}</tbody></table>` : emptyState("🧑‍🏫", "No teachers yet.")}
    </div></div>
    <div id="modalRoot"></div>`;
}

async function openAddTeacherModal() {
  const modalRoot = document.getElementById("modalRoot");
  modalRoot.innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this) this.remove()">
      <div class="modal">
        <h3>Add Teacher</h3>
        <form id="addTeacherForm">
          <div class="field"><label>School Registration Number (unique)</label><input required id="atReg" placeholder="e.g. TCH-1010"></div>
          <div class="field"><label>Full Name</label><input required id="atName"></div>
          <div class="field"><label>Qualification</label><input id="atQual"></div>
          <div class="grid cols-2">
            <div class="field"><label>Mobile Number</label><input id="atMobile"></div>
            <div class="field"><label>Email</label><input type="email" id="atEmail"></div>
          </div>
          <div id="atAlert"></div>
          <div class="form-actions">
            <button type="button" class="btn secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
            <button type="submit" class="btn">Save Teacher</button>
          </div>
        </form>
      </div>
    </div>`;
  document.getElementById("addTeacherForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const alertBox = document.getElementById("atAlert");
    try {
      await api("/teachers", { method: "POST", body: {
        registrationNumber: document.getElementById("atReg").value.trim(),
        name: document.getElementById("atName").value.trim(),
        qualification: document.getElementById("atQual").value || null,
        mobile: document.getElementById("atMobile").value || null,
        email: document.getElementById("atEmail").value || null,
      }});
      document.querySelector(".modal-overlay").remove();
      showToast("Teacher added successfully");
      route();
    } catch (err) {
      alertBox.innerHTML = `<div class="alert error">${escapeHtml(err.message)}</div>`;
    }
  });
}

async function openAssignModal(teacherId, teacherName) {
  const classes = await api("/classes");
  const modalRoot = document.getElementById("modalRoot");
  modalRoot.innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this) this.remove()">
      <div class="modal">
        <h3>Assign ${escapeHtml(teacherName)}</h3>
        <form id="assignForm">
          <div class="grid cols-2">
            <div class="field"><label>Class</label><select id="asgClass" required><option value="">Select</option>${classes.map((c) => `<option value="${c.id}">${escapeHtml(c.class_name)}</option>`).join("")}</select></div>
            <div class="field"><label>Section</label><select id="asgSection" required><option value="">Select class first</option></select></div>
          </div>
          <div class="field"><label>Subject</label><input id="asgSubject" required placeholder="e.g. Mathematics"></div>
          <div id="asgAlert"></div>
          <div class="form-actions">
            <button type="button" class="btn secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
            <button type="submit" class="btn">Assign</button>
          </div>
        </form>
      </div>
    </div>`;
  document.getElementById("asgClass").addEventListener("change", (e) => {
    const c = classes.find((c) => String(c.id) === e.target.value);
    document.getElementById("asgSection").innerHTML = c ? c.sections.map((s) => `<option value="${s.id}">${escapeHtml(s.section_name)}</option>`).join("") : `<option value="">Select class first</option>`;
  });
  document.getElementById("assignForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const alertBox = document.getElementById("asgAlert");
    try {
      await api(`/teachers/${teacherId}/assignments`, { method: "POST", body: {
        classId: document.getElementById("asgClass").value,
        sectionId: document.getElementById("asgSection").value,
        subject: document.getElementById("asgSubject").value.trim(),
      }});
      document.querySelector(".modal-overlay").remove();
      showToast("Teacher assigned");
    } catch (err) {
      alertBox.innerHTML = `<div class="alert error">${escapeHtml(err.message)}</div>`;
    }
  });
}

/* ---------------- CLASSES & SECTIONS (admin only) ---------------- */
async function renderClasses(content) {
  if (ME.user.role !== "admin") { content.innerHTML = emptyState("🚫", "You don't have access to this page."); return; }
  const classes = await api("/classes");
  content.innerHTML = `
    <div class="toolbar">
      <input id="newClassName" placeholder="New class name e.g. Class XI">
      <input id="newClassSession" placeholder="Academic session e.g. 2026-27" value="2026-27">
      <button class="btn small" onclick="addClass()">+ Add Class</button>
    </div>
    <div class="grid cols-2">
      ${classes.map((c) => `
        <div class="card">
          <h3>${escapeHtml(c.class_name)} <span style="font-weight:400;color:var(--muted);font-size:13px">(${escapeHtml(c.academic_session)})</span></h3>
          <div style="margin:10px 0">
            ${c.sections.length ? c.sections.map((s) => `<span class="badge cat-Academic" style="margin-right:6px">Section ${escapeHtml(s.section_name)}</span>`).join("") : `<span style="color:var(--muted);font-size:13px">No sections yet.</span>`}
          </div>
          <div style="display:flex;gap:8px">
            <input placeholder="New section e.g. C" id="sec-input-${c.id}" style="flex:1;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px">
            <button class="btn secondary small" onclick="addSection(${c.id})">Add Section</button>
          </div>
        </div>`).join("") || emptyState("🏫", "No classes yet.")}
    </div>`;
}

async function addClass() {
  const className = document.getElementById("newClassName").value.trim();
  const academicSession = document.getElementById("newClassSession").value.trim();
  if (!className || !academicSession) return showToast("Enter class name and session", "error");
  try {
    await api("/classes", { method: "POST", body: { className, academicSession } });
    showToast("Class added");
    route();
  } catch (err) { showToast(err.message, "error"); }
}
async function addSection(classId) {
  const input = document.getElementById(`sec-input-${classId}`);
  const sectionName = input.value.trim();
  if (!sectionName) return showToast("Enter a section name", "error");
  try {
    await api(`/classes/${classId}/sections`, { method: "POST", body: { sectionName } });
    showToast("Section added");
    route();
  } catch (err) { showToast(err.message, "error"); }
}

/* ---------------- ATTENDANCE ---------------- */
async function renderAttendance(content) {
  const role = ME.user.role;

  if (role === "admin") {
    // Overview: pick class/section/date and view (read-only)
    const classes = await api("/classes");
    content.innerHTML = attendanceFilterBar(classes) + `<div class="card"><div class="table-wrap" id="attTableWrap">${emptyState("🗓️", "Select a class and section to view attendance.")}</div></div>`;
    wireAttendanceFilters(classes, false);
    return;
  }

  if (role === "teacher") {
    const classes = await api("/classes");
    content.innerHTML = attendanceFilterBar(classes) + `
      <div class="card">
        <div class="table-wrap" id="attTableWrap">${emptyState("🗓️", "Select a class and section to mark attendance.")}</div>
        <div id="attSaveBar" style="display:none;margin-top:14px"><button class="btn small" onclick="saveAttendance()">Save Attendance</button></div>
      </div>`;
    wireAttendanceFilters(classes, true);
    return;
  }

  // student / parent — own attendance
  const data = await api(`/attendance/student/${ME.user.role === "student" || ME.user.role === "parent" ? "" : ""}`.replace("//", "/") , {}).catch(() => null);
  // linked_student_id isn't exposed on ME.user; fetch via /students (returns own record)
  const own = await api("/students");
  const studentId = own[0] ? own[0].id : null;
  if (!studentId) { content.innerHTML = emptyState("🗓️", "No attendance data available."); return; }
  const att = await api(`/attendance/student/${studentId}`);
  const pct = att.summary.percentage;
  content.innerHTML = `
    <div class="grid cols-3">
      ${statCard("Working Days", att.summary.workingDays, "🗓️")}
      ${statCard("Present", att.summary.present, "✅")}
      ${statCard("Absent", att.summary.absent, "❌")}
    </div>
    <div class="card" style="margin-top:16px">
      <h3>Attendance Percentage</h3>
      <div style="margin:12px 0 6px">${pct != null ? pct + "%" : "No data yet"}</div>
      <div class="progress-bar"><div style="width:${pct || 0}%"></div></div>
    </div>
    <div class="card" style="margin-top:16px">
      <h3>Recent Attendance</h3>
      <div class="table-wrap"><table><thead><tr><th>Date</th><th>Status</th></tr></thead><tbody>
      ${att.records.slice(0, 30).map((r) => `<tr><td data-label="Date">${escapeHtml(r.date)}</td><td data-label="Status"><span class="badge ${r.status}">${r.status}</span></td></tr>`).join("") || `<tr><td colspan="2">No records yet.</td></tr>`}
      </tbody></table></div>
    </div>`;
}

function attendanceFilterBar(classes) {
  return `<div class="toolbar">
    <select id="attClass"><option value="">Select Class</option>${classes.map((c) => `<option value="${c.id}">${escapeHtml(c.class_name)}</option>`).join("")}</select>
    <select id="attSection"><option value="">Select Section</option></select>
    <input type="date" id="attDate" value="${new Date().toISOString().slice(0, 10)}">
    <button class="btn secondary small" onclick="loadAttendanceTable()">Load</button>
  </div>`;
}

let ATT_CLASSES = [];
function wireAttendanceFilters(classes, editable) {
  ATT_CLASSES = classes;
  window.ATT_EDITABLE = editable;
  document.getElementById("attClass").addEventListener("change", (e) => {
    const c = classes.find((c) => String(c.id) === e.target.value);
    document.getElementById("attSection").innerHTML = `<option value="">Select Section</option>` + (c ? c.sections.map((s) => `<option value="${s.id}">${escapeHtml(s.section_name)}</option>`).join("") : "");
  });
}

async function loadAttendanceTable() {
  const classId = document.getElementById("attClass").value;
  const sectionId = document.getElementById("attSection").value;
  const date = document.getElementById("attDate").value;
  if (!classId || !sectionId) return showToast("Select class and section", "error");
  const rows = await api(`/attendance?classId=${classId}&sectionId=${sectionId}&date=${date}`);
  const editable = window.ATT_EDITABLE;

  document.getElementById("attTableWrap").innerHTML = rows.length ? `
    <table><thead><tr><th>Roll</th><th>Student</th><th>${editable ? "Mark" : "Status"}</th></tr></thead>
    <tbody>${rows.map((r) => `
      <tr data-student="${r.student_id}">
        <td data-label="Roll">${escapeHtml(r.roll_number || "-")}</td>
        <td data-label="Student">${escapeHtml(r.name)}</td>
        <td data-label="Status">
          ${editable ? `
            <label style="margin-right:10px;font-size:13px"><input type="radio" name="att-${r.student_id}" value="present" ${r.status === "present" || !r.status ? "checked" : ""}> Present</label>
            <label style="font-size:13px"><input type="radio" name="att-${r.student_id}" value="absent" ${r.status === "absent" ? "checked" : ""}> Absent</label>
          ` : `<span class="badge ${r.status || "absent"}">${r.status || "Not marked"}</span>`}
        </td>
      </tr>`).join("")}</tbody></table>` : emptyState("🎒", "No students in this class/section.");

  if (editable) document.getElementById("attSaveBar").style.display = "block";
}

async function saveAttendance() {
  const classId = document.getElementById("attClass").value;
  const sectionId = document.getElementById("attSection").value;
  const date = document.getElementById("attDate").value;
  const rows = [...document.querySelectorAll("#attTableWrap tr[data-student]")];
  const entries = rows.map((tr) => {
    const studentId = Number(tr.dataset.student);
    const checked = tr.querySelector(`input[name="att-${studentId}"]:checked`);
    return { studentId, status: checked ? checked.value : "present" };
  });
  try {
    await api("/attendance", { method: "POST", body: { classId, sectionId, date, entries } });
    showToast("Attendance saved for " + date);
  } catch (err) {
    showToast(err.message, "error");
  }
}

/* ---------------- ACADEMICS / MARKS ---------------- */
async function renderAcademics(content) {
  const role = ME.user.role;

  if (role === "admin") {
    content.innerHTML = `<div class="card">${emptyState("📘", "Academic records are entered by subject teachers. Use Students to drill into an individual student's marks via their profile.")}</div>`;
    return;
  }

  if (role === "teacher") {
    const [subjects, exams, students] = await Promise.all([
      api("/academics/subjects"), api("/academics/examinations"), api("/students"),
    ]);
    content.innerHTML = `
      <div class="toolbar">
        <select id="mkStudent"><option value="">Select Student</option>${students.map((s) => `<option value="${s.id}">${escapeHtml(s.name)} (${escapeHtml(s.registration_number)})</option>`).join("")}</select>
      </div>
      <div class="card" id="mkPanel">${emptyState("📘", "Select a student to view or enter marks.")}</div>`;

    document.getElementById("mkStudent").addEventListener("change", async (e) => {
      const studentId = e.target.value;
      const panel = document.getElementById("mkPanel");
      if (!studentId) { panel.innerHTML = emptyState("📘", "Select a student to view or enter marks."); return; }
      const marks = await api(`/marks?studentId=${studentId}`);
      panel.innerHTML = `
        <h3>Enter / Update Marks</h3>
        <form id="markForm" class="grid cols-2" style="margin-bottom:18px">
          <div class="field"><label>Subject</label><select id="mkSubject" required>${subjects.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("")}</select></div>
          <div class="field"><label>Examination</label><select id="mkExam" required>${exams.map((x) => `<option value="${x.id}">${escapeHtml(x.name)}</option>`).join("")}</select></div>
          <div class="field"><label>Maximum Marks</label><input type="number" id="mkMax" required value="100"></div>
          <div class="field"><label>Obtained Marks</label><input type="number" id="mkObt" required></div>
          <div class="field" style="grid-column:1/-1"><label>Remarks</label><input id="mkRemarks" placeholder="Optional teacher remarks"></div>
          <div style="grid-column:1/-1"><button class="btn small" type="submit">Save Marks</button></div>
        </form>
        <h3>Existing Records</h3>
        <div class="table-wrap"><table><thead><tr><th>Subject</th><th>Exam</th><th>Marks</th><th>Grade</th><th>Remarks</th></tr></thead><tbody>
        ${marks.map((m) => `<tr><td data-label="Subject">${escapeHtml(m.subject_name)}</td><td data-label="Exam">${escapeHtml(m.examination_name)}</td><td data-label="Marks">${m.obtained_marks}/${m.maximum_marks}</td><td data-label="Grade">${escapeHtml(m.grade || "-")}</td><td data-label="Remarks">${escapeHtml(m.remarks || "-")}</td></tr>`).join("") || `<tr><td colspan="5">No marks entered yet.</td></tr>`}
        </tbody></table></div>`;

      document.getElementById("markForm").addEventListener("submit", async (ev) => {
        ev.preventDefault();
        try {
          await api("/marks", { method: "POST", body: {
            studentId, subjectId: document.getElementById("mkSubject").value,
            examinationId: document.getElementById("mkExam").value,
            maximumMarks: Number(document.getElementById("mkMax").value),
            obtainedMarks: Number(document.getElementById("mkObt").value),
            remarks: document.getElementById("mkRemarks").value || null,
          }});
          showToast("Marks saved");
          document.getElementById("mkStudent").dispatchEvent(new Event("change"));
        } catch (err) { showToast(err.message, "error"); }
      });
    });
    return;
  }

  // student / parent
  const own = await api("/students");
  const studentId = own[0] ? own[0].id : null;
  if (!studentId) { content.innerHTML = emptyState("📘", "No academic records available."); return; }
  const marks = await api(`/marks?studentId=${studentId}`);
  content.innerHTML = `
    <div class="card"><div class="table-wrap"><table><thead><tr><th>Subject</th><th>Examination</th><th>Marks</th><th>%</th><th>Grade</th><th>Remarks</th></tr></thead><tbody>
    ${marks.map((m) => `<tr>
      <td data-label="Subject">${escapeHtml(m.subject_name)}</td>
      <td data-label="Examination">${escapeHtml(m.examination_name)}</td>
      <td data-label="Marks">${m.obtained_marks}/${m.maximum_marks}</td>
      <td data-label="%">${Math.round((m.obtained_marks / m.maximum_marks) * 1000) / 10}%</td>
      <td data-label="Grade">${escapeHtml(m.grade || "-")}</td>
      <td data-label="Remarks">${escapeHtml(m.remarks || "-")}</td>
    </tr>`).join("") || `<tr><td colspan="6">No academic records yet.</td></tr>`}
    </tbody></table></div></div>`;
}

/* ---------------- NOTICES ---------------- */
async function renderNotices(content) {
  const isAdmin = ME.user.role === "admin";
  const notices = await api("/notices");
  content.innerHTML = `
    ${isAdmin ? `<div class="toolbar"><button class="btn small" style="margin-left:auto" onclick="openNoticeModal()">+ New Notice</button></div>` : ""}
    <div class="grid cols-2">
      ${notices.map((n) => `
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:start;gap:10px">
            <h3 style="font-size:15px">${escapeHtml(n.title)}</h3>
            <span class="badge cat-${n.category}">${n.category}</span>
          </div>
          <p style="font-size:13.5px;color:var(--text);margin:8px 0;line-height:1.5">${escapeHtml(n.description)}</p>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px">
            <span style="font-size:12px;color:var(--muted)">${new Date(n.published_at).toLocaleDateString()} · <span class="badge ${n.status}">${n.status}</span></span>
            ${isAdmin ? `<button class="btn secondary small" onclick="deleteNotice(${n.id})">Delete</button>` : ""}
          </div>
        </div>`).join("") || emptyState("📭", "No notices published yet.")}
    </div>
    <div id="modalRoot"></div>`;
}

function openNoticeModal() {
  const modalRoot = document.getElementById("modalRoot");
  modalRoot.innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this) this.remove()">
      <div class="modal">
        <h3>New Notice</h3>
        <form id="noticeForm">
          <div class="field"><label>Title</label><input id="ntTitle" required></div>
          <div class="field"><label>Description</label><input id="ntDesc" required></div>
          <div class="field"><label>Category</label><select id="ntCategory"><option>Academic</option><option>Examination</option><option>General</option><option>Important</option></select></div>
          <div id="ntAlert"></div>
          <div class="form-actions">
            <button type="button" class="btn secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
            <button type="submit" class="btn">Publish</button>
          </div>
        </form>
      </div>
    </div>`;
  document.getElementById("noticeForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api("/notices", { method: "POST", body: {
        title: document.getElementById("ntTitle").value.trim(),
        description: document.getElementById("ntDesc").value.trim(),
        category: document.getElementById("ntCategory").value,
        status: "published",
      }});
      document.querySelector(".modal-overlay").remove();
      showToast("Notice published");
      route();
    } catch (err) {
      document.getElementById("ntAlert").innerHTML = `<div class="alert error">${escapeHtml(err.message)}</div>`;
    }
  });
}

async function deleteNotice(id) {
  if (!confirm("Delete this notice?")) return;
  try { await api(`/notices/${id}`, { method: "DELETE" }); showToast("Notice deleted"); route(); }
  catch (err) { showToast(err.message, "error"); }
}

/* ---------------- USER MANAGEMENT (admin only) ---------------- */
async function renderUsers(content) {
  if (ME.user.role !== "admin") { content.innerHTML = emptyState("🚫", "You don't have access to this page."); return; }
  const users = await api("/users");
  content.innerHTML = `
    <div class="card"><div class="table-wrap"><table><thead><tr><th>Username</th><th>Role</th><th>Status</th><th></th></tr></thead><tbody>
    ${users.map((u) => `<tr>
      <td data-label="Username">${escapeHtml(u.username)}</td>
      <td data-label="Role">${escapeHtml(u.role)}</td>
      <td data-label="Status"><span class="badge ${u.status}">${u.status}</span></td>
      <td data-label=""><button class="btn secondary small" onclick="toggleUserStatus(${u.id}, '${u.status}')">${u.status === "active" ? "Deactivate" : "Activate"}</button></td>
    </tr>`).join("")}</tbody></table></div></div>`;
}
async function toggleUserStatus(id, currentStatus) {
  const next = currentStatus === "active" ? "inactive" : "active";
  try { await api(`/users/${id}/status`, { method: "PUT", body: { status: next } }); showToast("User status updated"); route(); }
  catch (err) { showToast(err.message, "error"); }
}

/* ---------------- PROFILE ---------------- */
async function renderProfile(content) {
  const me = await api("/auth/me");
  const role = me.user.role;
  const p = me.profile || {};
  if (role === "admin") {
    content.innerHTML = `<div class="card"><h3>${escapeHtml(me.user.username)}</h3><p style="color:var(--muted);margin-top:4px">School Administrator</p></div>`;
    return;
  }
  if (role === "teacher") {
    content.innerHTML = `<div class="card">
      <h3>${escapeHtml(p.name || me.user.username)}</h3>
      <p style="color:var(--muted);margin:4px 0 14px">Reg. No: ${escapeHtml(p.registration_number || "-")}</p>
      <div class="grid cols-2">
        <div><strong style="font-size:12.5px;color:var(--muted)">QUALIFICATION</strong><p>${escapeHtml(p.qualification || "-")}</p></div>
        <div><strong style="font-size:12.5px;color:var(--muted)">MOBILE</strong><p>${escapeHtml(p.mobile || "-")}</p></div>
        <div><strong style="font-size:12.5px;color:var(--muted)">EMAIL</strong><p>${escapeHtml(p.email || "-")}</p></div>
        <div><strong style="font-size:12.5px;color:var(--muted)">STATUS</strong><p><span class="badge ${p.status}">${p.status}</span></p></div>
      </div>
    </div>`;
    return;
  }
  // student / parent
  const parentInfo = p.id ? await api(`/students/${p.id}`) : { parent: {} };
  const parent = parentInfo.parent || {};
  content.innerHTML = `<div class="card">
    <h3>${escapeHtml(p.name || "-")}</h3>
    <p style="color:var(--muted);margin:4px 0 14px">Reg. No: ${escapeHtml(p.registration_number || "-")}</p>
    <div class="grid cols-2">
      <div><strong style="font-size:12.5px;color:var(--muted)">CLASS</strong><p>${escapeHtml(parentInfo.student ? parentInfo.student.class_name : "-")} - ${escapeHtml(parentInfo.student ? parentInfo.student.section_name : "-")}</p></div>
      <div><strong style="font-size:12.5px;color:var(--muted)">ROLL NO.</strong><p>${escapeHtml(p.roll_number || "-")}</p></div>
      <div><strong style="font-size:12.5px;color:var(--muted)">DOB</strong><p>${escapeHtml(p.dob || "-")}</p></div>
      <div><strong style="font-size:12.5px;color:var(--muted)">GENDER</strong><p>${escapeHtml(p.gender || "-")}</p></div>
      <div><strong style="font-size:12.5px;color:var(--muted)">FATHER/GUARDIAN</strong><p>${escapeHtml(parent.father_name || "-")}</p></div>
      <div><strong style="font-size:12.5px;color:var(--muted)">MOTHER</strong><p>${escapeHtml(parent.mother_name || "-")}</p></div>
      <div><strong style="font-size:12.5px;color:var(--muted)">PARENT MOBILE</strong><p>${escapeHtml(parent.mobile || "-")}</p></div>
      <div><strong style="font-size:12.5px;color:var(--muted)">ADDRESS</strong><p>${escapeHtml(parent.address || "-")}</p></div>
    </div>
    <p class="hint" style="margin-top:14px">This profile is read-only. Contact the school admin for any corrections.</p>
  </div>`;
}

boot();
