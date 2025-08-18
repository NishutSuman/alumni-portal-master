// src/routes/users.js
const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth.middleware");
const { asyncHandler } = require('../utils/response');
const userController = require('../controllers/user.controller');

// Placeholder routes - we'll implement these later
router.get("/", authenticateToken, (req, res) => {
	res.json({ message: "Users route - coming soon" });
});


// Profile management
router.put('/profile', authenticateToken, asyncHandler(userController.updateProfile));

// Education management
router.get('/education', authenticateToken, asyncHandler(userController.getEducationHistory));
router.post('/education', authenticateToken, asyncHandler(userController.addEducation));
router.put('/education/:educationId', authenticateToken, asyncHandler(userController.updateEducation));
router.delete('/education/:educationId', authenticateToken, asyncHandler(userController.deleteEducation));

// Work experience management
router.get('/work-experience', authenticateToken, asyncHandler(userController.getWorkHistory));
router.post('/work-experience', authenticateToken, asyncHandler(userController.addWorkExperience));
router.put('/work-experience/:workId', authenticateToken, asyncHandler(userController.updateWorkExperience));
router.delete('/work-experience/:workId', authenticateToken, asyncHandler(userController.deleteWorkExperience));

module.exports = router;
