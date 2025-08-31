// tests/factories/user.factory.js
const { faker } = require('@faker-js/faker');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

class UserFactory {
  /**
   * Generate user data for testing
   * @param {Object} overrides - Override default values
   * @returns {Object} User data
   */
  static createUserData(overrides = {}) {
    return {
      email: faker.internet.email().toLowerCase(),
      password: 'TestPassword123!',
      fullName: faker.person.fullName(),
      batch: faker.number.int({ min: 2010, max: new Date().getFullYear() }),
      role: 'ALUMNI',
      isActive: true,
      isAlumniVerified: false,
      pendingVerification: false,
      ...overrides
    };
  }

  /**
   * Create test batch in database
   * @param {number} year - Batch year
   * @returns {Promise<Object>} Created batch
   */
  static async createTestBatch(year = 2020) {
    return await global.testPrisma.batch.create({
      data: {
        year,
        name: `Batch ${year}`,
        description: `Test batch for year ${year}`,
        totalMembers: 0,
        lastSerialCounter: 0
      }
    });
  }

  /**
   * Create test user in database
   * @param {Object} userData - User data overrides
   * @returns {Promise<Object>} Created user with batch
   */
  static async createTestUser(userData = {}) {
    const defaultData = this.createUserData(userData);
    
    // Ensure batch exists
    let batch = await global.testPrisma.batch.findUnique({
      where: { year: defaultData.batch }
    });
    
    if (!batch) {
      batch = await this.createTestBatch(defaultData.batch);
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(defaultData.password, 4); // Lower rounds for testing
    
    return await global.testPrisma.user.create({
      data: {
        serialId: `TST${Date.now()}${faker.number.int({ min: 100, max: 999 })}`,
        email: defaultData.email,
        password: hashedPassword,
        fullName: defaultData.fullName,
        batch: defaultData.batch, // Use batch year directly
        role: defaultData.role,
        isActive: defaultData.isActive,
        isAlumniVerified: defaultData.isAlumniVerified,
        pendingVerification: defaultData.pendingVerification,
        isRejected: defaultData.isRejected || false,
        joinedAt: new Date()
      },
      include: {
        batch_: {
          select: {
            id: true,
            year: true,
            name: true
          }
        }
      }
    });
  }

  /**
   * Create admin user
   * @param {string} role - Admin role (SUPER_ADMIN, BATCH_ADMIN)
   * @returns {Promise<Object>} Created admin user
   */
  static async createAdminUser(role = 'SUPER_ADMIN') {
    return await this.createTestUser({
      role,
      isAlumniVerified: true,
      pendingVerification: false
    });
  }

  /**
   * Create verified alumni user
   * @param {Object} overrides - Override default values
   * @returns {Promise<Object>} Created verified user
   */
  static async createVerifiedUser(overrides = {}) {
    return await this.createTestUser({
      isAlumniVerified: true,
      pendingVerification: false,
      ...overrides
    });
  }

  /**
   * Create unverified alumni user
   * @param {Object} overrides - Override default values
   * @returns {Promise<Object>} Created unverified user
   */
  static async createUnverifiedUser(overrides = {}) {
    return await this.createTestUser({
      isAlumniVerified: false,
      pendingVerification: true,
      ...overrides
    });
  }

  /**
   * Generate JWT token for testing
   * @param {string} userId - User ID
   * @param {string} type - Token type (access, refresh)
   * @returns {string} JWT token
   */
  static generateTestToken(userId, type = 'access') {
    const secret = type === 'refresh' ? process.env.JWT_REFRESH_SECRET : process.env.JWT_SECRET;
    const expiresIn = type === 'refresh' ? '7d' : '1h';
    
    return jwt.sign(
      { userId, type },
      secret,
      { expiresIn }
    );
  }

  /**
   * Create expired JWT token for testing
   * @param {string} userId - User ID
   * @returns {string} Expired JWT token
   */
  static generateExpiredToken(userId) {
    return jwt.sign(
      { userId, type: 'access' },
      process.env.JWT_SECRET,
      { expiresIn: '-1h' }
    );
  }
}

module.exports = UserFactory;

// tests/factories/auth.factory.js
const UserFactory = require('./user.factory');

class AuthFactory {
  /**
   * Create login credentials for existing user
   * @param {Object} user - User object
   * @param {string} password - Plain text password
   * @returns {Object} Login credentials
   */
  static createLoginCredentials(user, password = 'TestPassword123!') {
    return {
      email: user.email,
      password
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
   * Create blacklisted email for testing
   * @param {string} email - Email to blacklist
   * @param {string} reason - Blacklist reason
   * @returns {Promise<Object>} Created blacklisted email
   */
  static async createBlacklistedEmail(email = null, reason = 'Test blacklist') {
    const adminUser = await UserFactory.createAdminUser();
    
    return await global.testPrisma.blacklistedEmail.create({
      data: {
        email: email || UserFactory.createUserData().email,
        reason,
        isActive: true,
        blacklistedAdminId: adminUser.id,
        blacklistedAt: new Date()
      },
      include: {
        blacklistedAdmin: {
          select: {
            fullName: true,
            email: true
          }
        }
      }
    });
  }

  /**
   * Create password reset token data
   * @param {Object} user - User object
   * @returns {Promise<Object>} Reset token data
   */
  static async createPasswordResetToken(user) {
    const crypto = require('crypto');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour
    
    await global.testPrisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: resetToken,
        resetPasswordExpiry: resetTokenExpiry
      }
    });
    
    return { resetToken, resetTokenExpiry };
  }
}

module.exports = AuthFactory;

// tests/factories/index.js
module.exports = {
  UserFactory: require('./user.factory'),
  AuthFactory: require('./auth.factory')
};