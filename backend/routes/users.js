const express = require("express");
const db = require("../models/db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth, requireRole("admin"));

router.get("/", (req, res) => {
  res.json(db.prepare("SELECT id, username, role, status, created_at FROM users ORDER BY created_at DESC").all());
});

router.put("/:id/status", (req, res) => {
  const { status } = req.body || {};
  if (!["active", "inactive"].includes(status)) return res.status(400).json({ error: "status must be active or inactive" });
  db.prepare("UPDATE users SET status = ? WHERE id = ?").run(status, req.params.id);
  res.json({ message: "User status updated" });
});

module.exports = router;
