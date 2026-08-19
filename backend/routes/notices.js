const express = require("express");
const db = require("../models/db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/", (req, res) => {
  // everyone can view published notices; admin can also see drafts
  if (req.user.role === "admin") {
    return res.json(db.prepare("SELECT * FROM notices ORDER BY published_at DESC").all());
  }
  res.json(db.prepare("SELECT * FROM notices WHERE status = 'published' ORDER BY published_at DESC").all());
});

router.post("/", requireRole("admin"), (req, res) => {
  const { title, description, category, status } = req.body || {};
  if (!title || !description || !category) {
    return res.status(400).json({ error: "title, description and category are required" });
  }
  const info = db
    .prepare("INSERT INTO notices (title, description, category, published_by, status) VALUES (?,?,?,?,?)")
    .run(title, description, category, req.user.id, status || "published");
  res.status(201).json({ id: info.lastInsertRowid });
});

router.put("/:id", requireRole("admin"), (req, res) => {
  const { title, description, category, status } = req.body || {};
  const existing = db.prepare("SELECT * FROM notices WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Notice not found" });
  db.prepare("UPDATE notices SET title=?, description=?, category=?, status=? WHERE id=?").run(
    title || existing.title,
    description || existing.description,
    category || existing.category,
    status || existing.status,
    req.params.id
  );
  res.json({ message: "Notice updated" });
});

router.delete("/:id", requireRole("admin"), (req, res) => {
  db.prepare("DELETE FROM notices WHERE id = ?").run(req.params.id);
  res.json({ message: "Notice deleted" });
});

module.exports = router;
