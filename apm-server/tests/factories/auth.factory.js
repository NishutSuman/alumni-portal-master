// tests/factories/auth.factory.js
const { faker } = require("@faker-js/faker");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const UserFactory = require("./user.factory.js");

class AuthFactory {
	/**
	 * Create login credentials for existing user
	 * @param {Object} user - User object
	 * @param {string} password - Plain text password
	 * @returns {Object} Login credentials
	 */
	static createLoginCredentials(user, password = "TestPassword123!") {
		return {
			email: user.email,
			password,
		};
	}

	/**
	 * Create registration data
	 * @param {Object} overrides - Override default values
	 * @returns {Object} Registration data
	 */
	static createRegistrationData(overrides = {}) {
		return UserFactory.createUserData(overrides);
	}

	/**
	 * Create valid registration payload
	 * @param {Object} overrides - Override default values
	 * @returns {Object} Complete registration data
	 */
	static createValidRegistrationData(overrides = {}) {
		return {
			email: faker.internet.email().toLowerCase(),
			password: "TestPassword123!",
			fullName: faker.person.fullName(),
			batch: faker.number.int({ min: 2010, max: new Date().getFullYear() }),
			...overrides,
		};
	}

	/**
	 * Create invalid registration data for validation testing
	 * @param {string} invalidationType - Type of invalid data
	 * @returns {Object} Invalid registration data
	 */
	static createInvalidRegistrationData(invalidationType = "weak_password") {
		const baseData = this.createValidRegistrationData();

		switch (invalidationType) {
			case "weak_password":
				return { ...baseData, password: "123" };
			case "invalid_email":
				return { ...baseData, email: "invalid-email" };
			case "missing_fields":
				return { email: baseData.email };
			case "sql_injection":
				return { ...baseData, email: "admin@test.com'; DROP TABLE users; --" };
			case "xss_attempt":
				return { ...baseData, fullName: "<script>alert('xss')</script>" };
			default:
				return baseData;
		}
	}

	/**
	 * Create login data for testing
	 * @param {Object} overrides - Override default values
	 * @returns {Object} Login data
	 */
	static createLoginData(overrides = {}) {
		return {
			email: faker.internet.email().toLowerCase(),
			password: "TestPassword123!",
			...overrides,
		};
	}

	/**
	 * Create invalid login data for testing
	 * @param {string} invalidationType - Type of invalid data
	 * @returns {Object} Invalid login data
	 */
	static createInvalidLoginData(invalidationType = "wrong_password") {
		const baseData = this.createLoginData();

		switch (invalidationType) {
			case "wrong_password":
				return { ...baseData, password: "WrongPassword123!" };
			case "invalid_email":
				return { ...baseData, email: "nonexistent@test.com" };
			case "sql_injection":
				return { email: "admin@test.com' OR '1'='1' --", password: "any" };
			case "empty_fields":
				return { email: "", password: "" };
			default:
				return baseData;
		}
	}

	/**
	 * Create password change data
	 * @param {string} currentPassword - Current password
	 * @param {string} newPassword - New password
	 * @returns {Object} Password change data
	 */
	static createPasswordChangeData(
		currentPassword = "TestPassword123!",
		newPassword = "NewTestPassword123!"
	) {
		return {
			currentPassword,
			newPassword,
		};
	}

	/**
	 * Create forgot password data
	 * @param {string} email - Email for password reset
	 * @returns {Object} Forgot password data
	 */
	static createForgotPasswordData(email = null) {
		return {
			email: email || faker.internet.email().toLowerCase(),
		};
	}

	/**
	 * Create reset password data
	 * @param {string} token - Reset token
	 * @param {string} newPassword - New password
	 * @returns {Object} Reset password data
	 */
	static createResetPasswordData(
		token = "test-reset-token",
		newPassword = "NewTestPassword123!"
	) {
		return {
			token,
			newPassword,
		};
	}

	/**
	 * Create refresh token data
	 * @param {string} refreshToken - Refresh token
	 * @returns {Object} Refresh token data
	 */
	static createRefreshTokenData(refreshToken) {
		return {
			refreshToken,
		};
	}

	/**
	 * Generate test JWT tokens
	 * @param {string} userId - User ID
	 * @param {Object} options - Token options
	 * @returns {Object} Access and refresh tokens
	 */
	static generateTestTokens(userId, options = {}) {
		const accessToken = jwt.sign(
			{
				userId,
				type: "access",
				...options.accessTokenPayload,
			},
			process.env.JWT_SECRET || "test-secret",
			{ expiresIn: options.accessTokenExpiry || "1h" }
		);

		const refreshToken = jwt.sign(
			{
				userId,
				type: "refresh",
				...options.refreshTokenPayload,
			},
			process.env.JWT_REFRESH_SECRET || "test-refresh-secret",
			{ expiresIn: options.refreshTokenExpiry || "7d" }
		);

		return {
			accessToken,
			refreshToken,
		};
	}

	/**
	 * Generate expired token for testing
	 * @param {string} userId - User ID
	 * @param {string} type - Token type
	 * @returns {string} Expired token
	 */
	static generateExpiredToken(userId, type = "access") {
		const secret =
			type === "refresh"
				? process.env.JWT_REFRESH_SECRET || "test-refresh-secret"
				: process.env.JWT_SECRET || "test-secret";

		return jwt.sign(
			{ userId, type },
			secret,
			{ expiresIn: "-1h" } // Expired 1 hour ago
		);
	}

	/**
	 * Generate malformed token for testing
	 * @returns {string} Malformed token
	 */
	static generateMalformedToken() {
		return "invalid.jwt.token";
	}

	/**
	 * Create blacklisted email for testing
	 * @param {string} email - Email to blacklist
	 * @param {string} reason - Blacklist reason
	 * @returns {Promise<Object>} Created blacklisted email
	 */
	static async createBlacklistedEmail(email = null, reason = "Test blacklist") {
		const adminUser = await UserFactory.createAdminUser();

		return await global.testPrisma.blacklistedEmail.create({
			data: {
				email: email || faker.internet.email().toLowerCase(),
				reason,
				isActive: true,
				blacklistedAdminId: adminUser.id,
				blacklistedAt: new Date(),
			},
			include: {
				blacklistedAdmin: {
					select: {
						fullName: true,
						email: true,
					},
				},
			},
		});
	}

	/**
	 * Create password reset token data
	 * @param {Object} user - User object
	 * @returns {Promise<Object>} Reset token data
	 */
	static async createPasswordResetToken(user) {
		const crypto = require("crypto");
		const resetToken = crypto.randomBytes(32).toString("hex");
		const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

		await global.testPrisma.user.update({
			where: { id: user.id },
			data: {
				resetPasswordToken: resetToken,
				resetPasswordExpiry: resetTokenExpiry,
			},
		});

		return { resetToken, resetTokenExpiry };
	}

	/**
	 * Create multiple auth scenarios for testing
	 * @returns {Object} Multiple test scenarios
	 */
	static createAuthTestScenarios() {
		return {
			validRegistration: this.createValidRegistrationData(),
			weakPassword: this.createInvalidRegistrationData("weak_password"),
			invalidEmail: this.createInvalidRegistrationData("invalid_email"),
			sqlInjection: this.createInvalidRegistrationData("sql_injection"),
			xssAttempt: this.createInvalidRegistrationData("xss_attempt"),
			validLogin: this.createLoginData(),
			wrongPassword: this.createInvalidLoginData("wrong_password"),
			nonexistentUser: this.createInvalidLoginData("invalid_email"),
			sqlInjectionLogin: this.createInvalidLoginData("sql_injection"),
		};
	}

	/**
	 * Create test user with credentials
	 * @param {Object} overrides - User data overrides
	 * @returns {Promise<Object>} User with login credentials
	 */
	static async createUserWithCredentials(overrides = {}) {
		const password = "TestPassword123!";
		const user = await UserFactory.createTestUser({
			password,
			...overrides,
		});

		const tokens = this.generateTestTokens(user.id);

		return {
			user,
			credentials: {
				email: user.email,
				password,
			},
			tokens,
		};
	}

	/**
	 * Create authenticated request headers
	 * @param {string} token - Access token
	 * @returns {Object} Request headers
	 */
	static createAuthHeaders(token) {
		return {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		};
	}
}

module.exports = AuthFactory;
