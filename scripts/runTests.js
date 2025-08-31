// scripts/runTests.js
const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
require('colors');

class TestRunner {
  constructor() {
    this.testSuites = {
      unit: 'tests/unit',
      integration: 'tests/integration',
      e2e: 'tests/e2e',
      auth: 'tests/**/*auth*',
      security: 'tests/security',
      performance: 'tests/performance'
    };
    
    this.startTime = Date.now();
  }

  log(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = `[${timestamp}]`;
    
    switch (type) {
      case 'success':
        console.log(`${prefix} ✅ ${message}`.green);
        break;
      case 'error':
        console.log(`${prefix} ❌ ${message}`.red);
        break;
      case 'warning':
        console.log(`${prefix} ⚠️  ${message}`.yellow);
        break;
      case 'info':
        console.log(`${prefix} ℹ️  ${message}`.blue);
        break;
      default:
        console.log(`${prefix} ${message}`);
    }
  }

  async checkPrerequisites() {
    this.log('Checking test environment prerequisites...', 'info');
    
    const checks = [
      { name: 'Node.js version', check: this.checkNodeVersion },
      { name: 'Package dependencies', check: this.checkDependencies },
      { name: 'Environment configuration', check: this.checkEnvironment },
      { name: 'Database connectivity', check: this.checkDatabase },
      { name: 'Test file structure', check: this.checkTestStructure }
    ];
    
    for (const { name, check } of checks) {
      try {
        const result = await check.call(this);
        if (result) {
          this.log(`${name} ✓`, 'success');
        } else {
          this.log(`${name} ✗`, 'error');
          return false;
        }
      } catch (error) {
        this.log(`${name} failed: ${error.message}`, 'error');
        return false;
      }
    }
    
    this.log('All prerequisites met!', 'success');
    return true;
  }

  checkNodeVersion() {
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    return majorVersion >= 16; // Require Node 16+
  }

  checkDependencies() {
    const packagePath = path.join(process.cwd(), 'package.json');
    if (!fs.existsSync(packagePath)) {
      throw new Error('package.json not found');
    }
    
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const requiredDevDeps = ['jest', 'supertest', '@faker-js/faker'];
    
    for (const dep of requiredDevDeps) {
      if (!pkg.devDependencies?.[dep] && !pkg.dependencies?.[dep]) {
        throw new Error(`Missing dependency: ${dep}`);
      }
    }
    
    return true;
  }

  checkEnvironment() {
    // Check if .env.test file exists
    const envTestPath = path.join(process.cwd(), '.env.test');
    if (!fs.existsSync(envTestPath)) {
      throw new Error('.env.test file not found. Please create it with test configuration.');
    }
    
    // Load test environment
    require('dotenv').config({ path: envTestPath });
    
    // Check critical environment variables
    const requiredEnvVars = ['JWT_SECRET', 'NODE_ENV'];
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`Missing environment variable: ${envVar}`);
      }
    }
    
    return true;
  }

  async checkDatabase() {
    try {
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient({
        datasources: {
          db: {
            url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
          }
        }
      });
      
      await prisma.$connect();
      await prisma.$disconnect();
      return true;
    } catch (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }
  }

  checkTestStructure() {
    const requiredDirs = ['tests/setup', 'tests/factories', 'tests/unit', 'tests/integration'];
    
    for (const dir of requiredDirs) {
      const dirPath = path.join(process.cwd(), dir);
      if (!fs.existsSync(dirPath)) {
        throw new Error(`Missing test directory: ${dir}`);
      }
    }
    
    // Check for essential test files
    const requiredFiles = [
      'tests/setup/testSetup.js',
      'tests/factories/user.factory.js',
      'jest.config.js'
    ];
    
    for (const file of requiredFiles) {
      const filePath = path.join(process.cwd(), file);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Missing test file: ${file}`);
      }
    }
    
    return true;
  }

  async runCommand(command, description, options = {}) {
    this.log(`${description}...`, 'info');
    
    return new Promise((resolve, reject) => {
      const child = spawn('npm', ['run', command], {
        stdio: options.silent ? 'pipe' : 'inherit',
        shell: true,
        ...options
      });
      
      let output = '';
      let errorOutput = '';
      
      if (options.silent) {
        child.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        child.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });
      }
      
      child.on('close', (code) => {
        if (code === 0) {
          this.log(`${description} completed successfully`, 'success');
          resolve({ success: true, output, code });
        } else {
          this.log(`${description} failed with exit code ${code}`, 'error');
          if (errorOutput) {
            console.error(errorOutput);
          }
          resolve({ success: false, output, errorOutput, code });
        }
      });
      
      child.on('error', (error) => {
        this.log(`${description} failed: ${error.message}`, 'error');
        reject(error);
      });
    });
  }

  async runTestSuite(suiteName, options = {}) {
    if (!this.testSuites[suiteName]) {
      this.log(`Unknown test suite: ${suiteName}`, 'error');
      return false;
    }

    const testPattern = this.testSuites[suiteName];
    let command = `test:${suiteName}`;
    
    // Fallback to generic jest command if npm script doesn't exist
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      if (!packageJson.scripts[command]) {
        // Use direct jest command
        const jestCommand = `npx jest --testPathPattern="${testPattern}" --verbose`;
        return this.runJestCommand(jestCommand, `Running ${suiteName} tests`);
      }
    } catch (error) {
      this.log(`Error reading package.json: ${error.message}`, 'warning');
    }
    
    const result = await this.runCommand(command, `Running ${suiteName} tests`, options);
    return result.success;
  }

  async runJestCommand(command, description) {
    this.log(`${description}...`, 'info');
    
    return new Promise((resolve, reject) => {
      const child = exec(command, (error, stdout, stderr) => {
        if (error) {
          this.log(`${description} failed: ${error.message}`, 'error');
          console.log(stdout);
          console.error(stderr);
          resolve(false);
          return;
        }
        
        this.log(`${description} completed successfully`, 'success');
        console.log(stdout);
        resolve(true);
      });
      
      child.on('error', (error) => {
        this.log(`${description} failed: ${error.message}`, 'error');
        resolve(false);
      });
    });
  }

  async runAllTests() {
    this.log('Starting comprehensive test execution...', 'info');
    
    const suites = ['unit', 'integration', 'security', 'e2e'];
    const results = {};
    let totalPassed = 0;
    
    for (const suite of suites) {
      this.log(`\n${'='.repeat(50)}`, 'info');
      this.log(`RUNNING ${suite.toUpperCase()} TESTS`, 'info');
      this.log(`${'='.repeat(50)}`, 'info');
      
      const success = await this.runTestSuite(suite);
      results[suite] = success;
      
      if (success) {
        totalPassed++;
      }
      
      this.log(`${suite} tests: ${success ? 'PASSED' : 'FAILED'}`, success ? 'success' : 'error');
    }
    
    // Print summary
    this.printTestSummary(results, totalPassed, suites.length);
    
    return totalPassed === suites.length;
  }

  printTestSummary(results, passed, total) {
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);
    
    console.log('\n' + '='.repeat(60));
    console.log('TEST EXECUTION SUMMARY'.bold);
    console.log('='.repeat(60));
    
    Object.entries(results).forEach(([suite, success]) => {
      const status = success ? '✅ PASSED'.green : '❌ FAILED'.red;
      console.log(`${suite.padEnd(15)} : ${status}`);
    });
    
    console.log('='.repeat(60));
    console.log(`Total Suites: ${total}`);
    console.log(`Passed: ${passed.toString().green}`);
    console.log(`Failed: ${(total - passed).toString().red}`);
    console.log(`Duration: ${duration}s`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
    
    if (passed === total) {
      console.log('\n🎉 ALL TESTS PASSED! 🎉'.green.bold);
    } else {
      console.log('\n⚠️  SOME TESTS FAILED ⚠️'.red.bold);
    }
    
    console.log('='.repeat(60));
  }

  async generateCoverageReport() {
    const result = await this.runCommand('test:coverage', 'Generating coverage report');
    
    if (result.success) {
      this.log('Coverage report generated successfully', 'success');
      this.log('Open coverage/index.html to view detailed report', 'info');
    }
    
    return result.success;
  }

  async runPerformanceTests() {
    this.log('Running performance benchmarks...', 'info');
    
    const result = await this.runTestSuite('performance');
    
    if (result) {
      this.log('Performance tests completed successfully', 'success');
    } else {
      this.log('Performance tests failed or detected issues', 'warning');
    }
    
    return result;
  }

  async runSecurityTests() {
    this.log('Running security validation tests...', 'info');
    
    const result = await this.runTestSuite('security');
    
    if (result) {
      this.log('Security tests passed - no vulnerabilities detected', 'success');
    } else {
      this.log('Security tests failed - potential vulnerabilities detected!', 'error');
    }
    
    return result;
  }

  printUsage() {
    console.log(`
Usage: node scripts/runTests.js [command]

Commands:
  unit          Run unit tests only
  integration   Run integration tests only
  e2e           Run end-to-end tests only
  auth          Run authentication-related tests only
  security      Run security validation tests
  performance   Run performance benchmark tests
  coverage      Generate test coverage report
  all           Run all test suites (default)

Examples:
  node scripts/runTests.js                 # Run all tests
  node scripts/runTests.js unit            # Run unit tests only
  node scripts/runTests.js coverage        # Generate coverage report
  node scripts/runTests.js security        # Run security tests

Environment:
  Make sure .env.test file exists with proper test configuration
  Test database should be accessible and properly migrated
    `.trim());
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const runner = new TestRunner();

  // Print usage if help requested
  if (args.includes('--help') || args.includes('-h')) {
    runner.printUsage();
    process.exit(0);
  }

  console.log('🧪 Alumni Portal Test Runner'.bold.blue);
  console.log('================================\n');

  // Check prerequisites
  const prerequisitesPassed = await runner.checkPrerequisites();
  if (!prerequisitesPassed) {
    runner.log('Prerequisites not met. Please fix the issues above and try again.', 'error');
    process.exit(1);
  }

  try {
    const command = args[0] || 'all';
    let success = false;

    switch (command) {
      case 'unit':
      case 'integration':
      case 'e2e':
      case 'auth':
        success = await runner.runTestSuite(command);
        break;
        
      case 'security':
        success = await runner.runSecurityTests();
        break;
        
      case 'performance':
        success = await runner.runPerformanceTests();
        break;
        
      case 'coverage':
        success = await runner.generateCoverageReport();
        break;
        
      case 'all':
        success = await runner.runAllTests();
        break;
        
      default:
        runner.log(`Unknown command: ${command}`, 'error');
        runner.printUsage();
        process.exit(1);
    }

    process.exit(success ? 0 : 1);
    
  } catch (error) {
    runner.log(`Test runner failed: ${error.message}`, 'error');
    console.error(error.stack);
    process.exit(1);
  }
}

// Export for programmatic use
module.exports = TestRunner;

// Run if called directly
if (require.main === module) {
  main();
}