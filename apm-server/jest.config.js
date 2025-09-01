// jest.config.js - Improved for Feature-by-Feature Testing
module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup/testSetup.js'],
  
  // DEFAULT: Run all tests (use npm test)
  testMatch: ['**/tests/**/*.test.js'],
  
  // FEATURE-SPECIFIC: Use npm run test:auth, test:events, etc.
  // This is handled by --testPathPattern in package.json scripts
  
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/**/*.test.js',
    '!src/config/**',
    '!src/utils/**' // Exclude utils unless specifically testing them
  ],
  
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  
  // Performance settings
  testTimeout: 15000, // Increased for database operations
  clearMocks: true,
  verbose: true,
  
  // Global setup/teardown
  globalSetup: '<rootDir>/tests/setup/globalSetup.js',
  globalTeardown: '<rootDir>/tests/setup/globalTeardown.js',
  
  // Improved error handling
  errorOnDeprecated: true,
  
  // Coverage thresholds (optional - enforce minimum coverage)
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    },
    // Feature-specific thresholds
    'src/controllers/auth/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    'src/middleware/auth/': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },
  
  // Test result processor for better output
  testResultsProcessor: undefined,
  
  // Module path mapping (if needed for absolute imports)
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/coverage/'
  ],
  
  // Transform ignore patterns
  transformIgnorePatterns: [
    '/node_modules/'
  ]
};