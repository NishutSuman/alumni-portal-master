// src/server.js
const app = require("./app");
const config = require("./config");
const { connectDB, disconnectDB } = require("./config/database");
const MembershipExpiryJob = require("./jobs/membershipExpiry.job");
const DailyCelebrationJob = require("./jobs/dailyCelebrationJob");
const WeeklyFestivalSyncJob = require("./jobs/weeklyFestivalSyncJob");

let server;

async function startServer() {
	try {
		// Connect to database
		await connectDB();

		// Start the server
		server = app.listen(config.port, () => {
			console.log(
				`🚀 Server running on port ${config.port} in ${config.nodeEnv} mode`
			);
			console.log(`📱 Health check: http://localhost:${config.port}/health`);
			console.log(`🔗 API base URL: http://localhost:${config.port}/api`);
		});

		// Handle server errors
		server.on("error", (error) => {
			if (error.syscall !== "listen") {
				throw error;
			}

			const bind =
				typeof config.port === "string"
					? `Pipe ${config.port}`
					: `Port ${config.port}`;

			switch (error.code) {
				case "EACCES":
					console.error(`${bind} requires elevated privileges`);
					process.exit(1);
					break;
				case "EADDRINUSE":
					console.error(`${bind} is already in use`);
					process.exit(1);
					break;
				default:
					throw error;
			}
		});

		// Initialize membership expiry job
		// MembershipExpiryJob.initialize();

		// For development/testing - run manual check on startup
		// if (process.env.NODE_ENV === "development") {
		// 	setTimeout(() => {
		// 		MembershipExpiryJob.runManual();
		// 	}, 5000); // Run after 5 seconds on dev startup
		// }
		try {
			// Initialize daily celebration job (birthdays + festivals at 8 AM)
			//   DailyCelebrationJob.initialize();
			//   console.log('✅ Daily celebration job initialized');
			// Initialize weekly festival sync job (external API sync on Sundays at 3 AM)
			//   WeeklyFestivalSyncJob.initialize();
			//   console.log('✅ Weekly festival sync job initialized');
			// For development/testing - optional manual trigger on startup
			//   if (process.env.NODE_ENV === "development") {
			//     console.log('🧪 Development mode: Setting up test triggers...');
			// console.log('🎊 Celebration system initialization completed');

		} catch (error) {
			// console.error("❌ Failed to initialize celebration system:", error);
			// Don't exit - let server continue running without celebration jobs
		}
	} catch (error) {
		console.error("Failed to start server:", error);
		process.exit(1);
	}
}

// Graceful shutdown
async function gracefulShutdown(signal) {
	console.log(`\n📴 Received ${signal}. Starting graceful shutdown...`);

	if (server) {
		server.close(async () => {
			console.log("🔌 HTTP server closed");

			try {
				await disconnectDB();
				console.log("✅ Graceful shutdown completed");
				process.exit(0);
			} catch (error) {
				console.error("❌ Error during shutdown:", error);
				process.exit(1);
			}
		});

		// Force close server after 30 seconds
		setTimeout(() => {
			console.error(
				"⏰ Could not close connections in time, forcefully shutting down"
			);
			process.exit(1);
		}, 30000);
	} else {
		await disconnectDB();
		process.exit(0);
	}
}

// Handle process termination
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
	console.error("Uncaught Exception:", error);
	gracefulShutdown("UNCAUGHT_EXCEPTION");
});

process.on("unhandledRejection", (reason, promise) => {
	console.error("Unhandled Rejection at:", promise, "reason:", reason);
	gracefulShutdown("UNHANDLED_REJECTION");
});

// Start the server
if (require.main === module) {
	startServer();
}

module.exports = { startServer, gracefulShutdown };
