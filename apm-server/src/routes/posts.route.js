// src/routes/posts.js
const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth.middleware");

// Placeholder routes - we'll implement these later
router.get("/", (req, res) => {
	res.json({ message: "Posts route - coming soon" });
});

module.exports = router;
