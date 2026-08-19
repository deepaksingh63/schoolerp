# 🎓 SD Public School — Smart School Management Portal

A role-based school management portal for **Admin**, **Teacher**, and **Student/Parent**, built with a real backend (Node.js + Express + SQLite) and a lightweight, dependency-free frontend (HTML/CSS/vanilla JS) served by the same server — no separate build step required.

## ✨ What's new: Signup with School Registration Number

Teachers, students, and parents no longer need the admin to create their login manually. A new **`signup.html`** page lets them self-register — but only after the school has issued them a **unique School Registration Number**:

- **Admin** creates the student/teacher record first (this is where the unique `registration_number` is issued — enforced unique at the database level).
- The teacher/student then visits **Sign Up**, picks their role, and enters that registration number plus a username/password. The backend verifies the number matches a real, unclaimed record before creating the login — it's never trusted blindly from the form.
- **Parents** sign up using their **child's** registration number, which links their account to that student.
- A registration number can only be used once per role — trying to sign up twice with the same number returns a clear "account already exists" error.

This keeps the "no unauthorized access" requirement intact: nobody can create a login unless the school has already put them on record.

## Project Structure

```
sd-public-school/
├── backend/
│   ├── models/db.js          # SQLite schema (better-sqlite3)
│   ├── routes/                # auth, students, teachers, classes, attendance, marks, notices, users, academics, dashboard
│   ├── middleware/auth.js     # JWT verification + role-based access control
│   ├── seed.js                # Realistic demo data + demo accounts
│   ├── server.js              # Express app entry point
│   └── .env.example
├── frontend/
│   └── public/
│       ├── login.html
│       ├── signup.html        # ← the new self-registration page
│       ├── app.html            # Single shell; role-based dashboard/pages via JS routing
│       ├── js/{api.js, app.js}
│       └── css/style.css
├── docs/
└── README.md
```

## Setup Instructions

Requires Node.js 18+.

```bash
cd backend
cp .env.example .env      # edit JWT_SECRET before any real deployment
npm install
npm run seed               # creates the SQLite DB + demo data
npm start                  # starts server on http://localhost:4000
```

Open **http://localhost:4000** in your browser. It serves both the API (`/api/...`) and the frontend.

## Default Demo Credentials

| Role    | Username | Password    |
|---------|----------|-------------|
| Admin   | admin    | Admin@123   |
| Teacher | teacher  | Teacher@123 |
| Student | student  | Student@123 |
| Parent  | parent   | Parent@123  |

These are seeded for **development only** — change or remove them before any production use.

### Try the new signup flow
After seeding, these registration numbers are pre-created but **unclaimed**, so you can sign up with them via `signup.html`:
- Teacher: `TCH-1002`, `TCH-1003`, `TCH-1004`, `TCH-1005`, `TCH-1006`
- Student: `STU-2002`, `STU-2003`, `STU-2004` (run `npm run seed` and check the console output for the full current list — it's regenerated each time you reseed)
- Parent: any existing student's registration number (e.g. `STU-2002`)

## API Documentation (summary)

All endpoints are prefixed with `/api`. Protected routes require `Authorization: Bearer <token>`.

**Auth**
- `POST /auth/signup` — `{ role, registrationNumber, username, password }` → self-register (teacher/student/parent)
- `POST /auth/login` — `{ username, password }` → `{ token, user }`
- `POST /auth/logout`
- `GET /auth/me` — current user + linked profile

**Students** — `GET/POST /students`, `GET/PUT/DELETE /students/:id` (admin manages; teacher sees only assigned classes; student/parent see only their own record)

**Teachers** — `GET/POST /teachers`, `GET/PUT /teachers/:id`, `POST /teachers/:id/assignments` (admin only)

**Classes** — `GET/POST /classes`, `POST /classes/:classId/sections` (admin manages, others read)

**Attendance** — `GET /attendance?classId&sectionId&date`, `POST /attendance` (teacher, own assigned class only), `GET /attendance/student/:id` (own data only, enforced server-side)

**Marks** — `GET /marks?studentId`, `POST /marks`, `PUT /marks/:id` (teacher, own assigned students only)

**Notices** — `GET/POST/PUT/DELETE /notices` (admin manages, everyone reads published ones)

**Users** — `GET /users`, `PUT /users/:id/status` (admin only — activate/deactivate accounts)

**Dashboard** — `GET /dashboard` — role-aware summary stats

## Security

- Passwords hashed with bcrypt; JWTs signed server-side with an expiry.
- Role is **read from the verified JWT on every request**, never trusted from the client.
- Ownership checks enforce that a student/parent can only ever read **their own** linked record — even if they edit the `:id` in the URL directly (tested, see below).
- Duplicate attendance for the same student + date is prevented at the database level (`UNIQUE(student_id, date)`), same for marks (`UNIQUE(student_id, subject_id, examination_id)`) and registration numbers (`UNIQUE`).
- Input is validated on every write route; SQL is fully parameterized (no string-built queries).

## Testing

A manual test pass was run against the live server covering:
- ✅ Login / invalid login / deactivated account
- ✅ Signup with a valid, unclaimed registration number for each role
- ✅ Signup rejected for an already-claimed or unknown registration number
- ✅ **Security test**: a parent account cannot access another student's profile or attendance by changing the `:id` in the request — confirmed 403 in both cases
- ✅ Duplicate attendance prevented (upsert on `student_id + date`)
- ✅ Teacher restricted to assigned class/section for attendance and marks

For a full automated test suite, add a test runner (e.g. Jest + Supertest) under `backend/tests/` following the same scenarios.

## Notes

- Database: SQLite via `better-sqlite3` for a zero-install, file-based relational DB. Swap `models/db.js` for Postgres/MySQL in production with minimal query changes (all SQL is standard, parameterized).
- Frontend intentionally uses plain HTML/CSS/JS (no build step) so the whole app runs with a single `npm start` — no separate frontend dev server needed.
