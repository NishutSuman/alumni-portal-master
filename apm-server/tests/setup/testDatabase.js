const { PrismaClient } = require('@prisma/client');

class TestDatabase {
  constructor() {
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
        }
      }
    });
  }

  async connect() {
    await this.prisma.$connect();
  }

  async disconnect() {
    await this.prisma.$disconnect();
  }

  async cleanDatabase() {
    // Clean in dependency order
    const tablesToClean = [
      'activityLog',
      'blacklistedEmail',
      'user',
      'batch'
    ];
    
    for (const table of tablesToClean) {
      try {
        await this.prisma[table].deleteMany({});
      } catch (error) {
        console.warn(`Failed to clean ${table}:`, error.message);
      }
    }
  }

  async createTestBatch(year = 2020) {
    return await this.prisma.batch.upsert({
      where: { year },
      update: {},
      create: {
        year,
        name: `Test Batch ${year}`,
        description: `Test batch for year ${year}`,
        totalMembers: 0,
        lastSerialCounter: 0
      }
    });
  }

  // Utility method to check if database is ready
  async isReady() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      return false;
    }
  }

  // Method to reset auto-increment sequences (if needed)
  async resetSequences() {
    try {
      // This is PostgreSQL specific
      const tables = ['user', 'batch', 'activityLog', 'blacklistedEmail'];
      for (const table of tables) {
        await this.prisma.$executeRawUnsafe(
          `ALTER SEQUENCE ${table}_id_seq RESTART WITH 1`
        );
      }
    } catch (error) {
      console.warn('Could not reset sequences:', error.message);
    }
  }
}

module.exports = TestDatabase;