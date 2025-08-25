// src/app.js
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const config = require("./config");
// const emailManager = require("./services/email/EmailManager");

const app = express();

// Security middleware with relaxed CSP for testing
app.use(
	helmet({
		contentSecurityPolicy: {
			directives: {
				defaultSrc: ["'self'"],
				styleSrc: ["'self'", "'unsafe-inline'"],
				scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for testing
				imgSrc: ["'self'", "data:", "https:"],
				connectSrc: ["'self'", "https://api.razorpay.com"], // Allow Razorpay API
			},
		},
	})
);

// Important: For webhook handling, ensure raw body parsing for specific routes
app.use("/api/payments/webhook/*", express.raw({ type: "application/json" }));

// CORS configuration - Allow both development ports
app.use(
	cors({
		origin: [
			process.env.FRONTEND_URL || "http://localhost:3000",
			"http://localhost:5000", // Allow testing port
			"http://localhost:3001", // Allow dev port
		],
		credentials: true,
		methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
		allowedHeaders: ["Content-Type", "Authorization"],
	})
);

// Rate limiting - DISABLED for testing (can be enabled later)
const limiter = rateLimit({
	windowMs: config.rateLimit.windowMs,
	max: config.rateLimit.max,
	message: {
		error: "Too many requests from this IP, please try again later.",
	},
	standardHeaders: true,
	legacyHeaders: false,
	skip: (req) => {
		// Skip rate limiting in development mode or for testing
		return config.nodeEnv === "development";
	},
});

// Apply rate limiting only in production
if (config.nodeEnv === "production") {
	app.use("/api/", limiter);
}

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Logging middleware
if (config.nodeEnv === "development") {
	app.use(morgan("dev"));
} else {
	app.use(morgan("combined"));
}

// Health check endpoint - FIXED PATH
app.get("/health", (req, res) => {
	res.status(200).json({
		success: true,
		status: "OK",
		timestamp: new Date().toISOString(),
		environment: config.nodeEnv,
		port: config.port,
		payment: {
			provider: process.env.PAYMENT_PROVIDER || "not configured",
			configured: !!(
				process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
			),
		},
		database: {
			url: !!process.env.DATABASE_URL ? "configured" : "not configured",
		},
	});
});

// API health endpoint (for consistency with test)
app.get("/api/health", (req, res) => {
	res.redirect("/health");
});

// Serve static files from uploads directory
app.use("/uploads", express.static("public/uploads"));

// Serve test files - ENABLED for testing
app.use(express.static("public"));

// Initialize email system on app startup ---> Temporoary Disable
// emailManager
// 	.initialize()
// 	.then((result) => {
// 		if (result.success) {
// 			console.log("✅ Email system initialized successfully");
// 		} else {
// 			console.error("❌ Email system initialization failed:", result.error);
// 		}
// 	})
// 	.catch((error) => {
// 		console.error("❌ Email system initialization error:", error);
// 	});

// =============================================
// API ROUTES REGISTRATION
// =============================================

// Core routes
app.use("/api/auth", require("./routes/auth.route"));
app.use("/api/users", require("./routes/users.route"));
app.use("/api/batches", require("./routes/batches.route"));
app.use("/api/alumni", require("./routes/alumni.route"));
app.use("/api/posts", require("./routes/posts.route"));
app.use("/api/events", require("./routes/events.route"));
app.use('/api/admin', require('./routes/admin.route'));
app.use('/api/payments', require('./routes/payments.route'));
app.use('/api/treasury', require('./routes/treasury.route'));
app.use('/api/albums', require('./routes/albums.route'));
app.use('/api/photos', require('./routes/photos.route'));
app.use("/api/groups", require("./routes/group.route"));
app.use("/api/polls", require("./routes/polls.route"));

// PAYMENT ROUTES - ENABLED (was commented out)
try {
	app.use("/api/payments", require("./routes/payments.route"));
	console.log("✅ Payment routes registered successfully");
} catch (error) {
	console.error("❌ Failed to register payment routes:", error.message);
	console.error("💡 Make sure src/routes/payments.route.js exists");
}

// Email Routes
app.use("/api", require("./routes/email.route"));

// Additional routes (disabled for now)
// app.use('/api/transactions', require('./routes/transactions.route'));
// app.use('/api/notifications', require('./routes/notifications.route'));

// =============================================
// ERROR HANDLING
// =============================================

// 404 handler
app.use("*", (req, res) => {
	res.status(404).json({
		success: false,
		message: `Route ${req.originalUrl} not found`,
		suggestion: req.originalUrl.includes("/api/")
			? "Check if the API endpoint exists and is properly registered"
			: "This might be a static file request - check the public directory",
	});
});

// Global error handler
app.use((err, req, res, next) => {
	console.error("Error details:", {
		message: err.message,
		stack: config.nodeEnv === "development" ? err.stack : undefined,
		url: req.originalUrl,
		method: req.method,
		body: req.body,
		params: req.params,
	});

	// Prisma errors
	if (err.code === "P2002") {
		return res.status(409).json({
			success: false,
			message: "Duplicate entry found",
			error:
				config.nodeEnv === "development" ? err.message : "Database conflict",
		});
	}

	// Validation errors
	if (err.isJoi) {
		return res.status(400).json({
			success: false,
			message: "Validation error",
			errors: err.details.map((detail) => detail.message),
		});
	}

	// JWT errors
	if (err.name === "JsonWebTokenError") {
		return res.status(401).json({
			success: false,
			message: "Invalid token",
		});
	}

	if (err.name === "TokenExpiredError") {
		return res.status(401).json({
			success: false,
			message: "Token expired",
		});
	}

	// Payment-specific errors
	if (err.name === "PaymentError") {
		return res.status(err.statusCode || 400).json({
			success: false,
			message: err.message,
			errorCode: err.code || "PAYMENT_ERROR",
		});
	}

	// Razorpay errors
	if (err.error && err.error.code) {
		return res.status(400).json({
			success: false,
			message: "Payment gateway error",
			errorCode: err.error.code,
			error:
				config.nodeEnv === "development" ? err.error.description : undefined,
		});
	}

	// Default error
	res.status(err.status || 500).json({
		success: false,
		message: err.message || "Internal server error",
		error: config.nodeEnv === "development" ? err.stack : undefined,
	});
});

// Export the app
module.exports = app;
