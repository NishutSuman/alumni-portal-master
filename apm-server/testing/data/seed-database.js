// testing/data/seed-database.js
// Comprehensive Database Seeding for Testing
// Creates realistic test data matching the PDF plan

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { faker } = require('@faker-js/faker');
const colors = require('colors');

const prisma = new PrismaClient();

class DatabaseSeeder {
  constructor() {
    this.createdData = {
      users: [],
      batches: [],
      events: [],
      categories: []
    };
    
    console.log('🌱 Database Seeding for Testing'.green.bold);
    console.log('Following Practical API Testing Plan'.gray);
  }

  log(message, type = 'info') {
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const colorMap = { success: 'green', error: 'red', warning: 'yellow', info: 'blue' };
    console.log(`${icons[type]} ${message}`[colorMap[type]]);
  }

  // =============================================
  // UTILITY METHODS
  // =============================================

  async hashPassword(password) {
    return await bcrypt.hash(password, 12);
  }

  generateRollNumber(batch) {
    const prefix = batch.toString().slice(-2);
    const suffix = faker.string.numeric(4);
    return `${prefix}${suffix}`;
  }

  // =============================================
  // SEEDING METHODS
  // =============================================

  async seedBatches() {
    this.log('\n📚 Seeding Batches (2015-2023)...', 'info');
    
    const batchYears = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023];
    
    for (const year of batchYears) {
      try {
        const batch = await prisma.batch.upsert({
          where: { year },
          update: {},
          create: {
            year,
            name: `Batch of ${year}`,
            description: `Alumni batch graduating in ${year}`,
            totalMembers: faker.number.int({ min: 50, max: 150 })
          }
        });
        
        this.createdData.batches.push(batch);
        this.log(`   Created batch: ${year}`, 'success');
      } catch (error) {
        this.log(`   Failed to create batch ${year}: ${error.message}`, 'error');
      }
    }
  }

  async seedUsers() {
    this.log('\n👥 Seeding Test Users...', 'info');
    
    const hashedPassword = await this.hashPassword('TestPassword123!');

    // 1. Create Super Admin
    try {
      const admin = await prisma.user.upsert({
        where: { email: 'admin@test.com' },
        update: {},
        create: {
          email: 'admin@test.com',
          password: hashedPassword,
          firstName: 'Super',
          lastName: 'Admin',
          fullName: 'Super Admin',
          role: 'SUPER_ADMIN',
          batch: 2020,
          rollNumber: 'ADMIN001',
          phoneNumber: '9876543210',
          isActive: true,
          emailVerified: true,
          alumniVerified: true,
          profileImage: faker.image.avatar()
        }
      });
      
      this.createdData.users.push(admin);
      this.log('   Created Super Admin: admin@test.com', 'success');
    } catch (error) {
      this.log(`   Failed to create admin: ${error.message}`, 'error');
    }

    // 2. Create Batch Admins (2019-2022)
    const batchAdminYears = [2019, 2020, 2021, 2022];
    
    for (const year of batchAdminYears) {
      try {
        const batchAdmin = await prisma.user.upsert({
          where: { email: `batchadmin${year}@test.com` },
          update: {},
          create: {
            email: `batchadmin${year}@test.com`,
            password: hashedPassword,
            firstName: `Batch${year}`,
            lastName: 'Admin',
            fullName: `Batch ${year} Admin`,
            role: 'USER', // Regular user with batch admin assignment
            batch: year,
            rollNumber: this.generateRollNumber(year),
            phoneNumber: faker.phone.number(),
            isActive: true,
            emailVerified: true,
            alumniVerified: true,
            profileImage: faker.image.avatar()
          }
        });
        
        this.createdData.users.push(batchAdmin);
        this.log(`   Created Batch Admin: batchadmin${year}@test.com`, 'success');
      } catch (error) {
        this.log(`   Failed to create batch admin ${year}: ${error.message}`, 'error');
      }
    }

    // 3. Create Regular Test User
    try {
      const user = await prisma.user.upsert({
        where: { email: 'user@test.com' },
        update: {},
        create: {
          email: 'user@test.com',
          password: hashedPassword,
          firstName: 'Test',
          lastName: 'User',
          fullName: 'Test User',
          role: 'USER',
          batch: 2020,
          rollNumber: this.generateRollNumber(2020),
          phoneNumber: faker.phone.number(),
          isActive: true,
          emailVerified: true,
          alumniVerified: true,
          profileImage: faker.image.avatar()
        }
      });
      
      this.createdData.users.push(user);
      this.log('   Created Regular User: user@test.com', 'success');
    } catch (error) {
      this.log(`   Failed to create regular user: ${error.message}`, 'error');
    }

    // 4. Create 30+ Random Alumni (as per PDF plan)
    this.log('   Creating 30+ random alumni...', 'info');
    
    const batchYears = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023];
    let userCount = 0;
    
    for (let i = 0; i < 35; i++) {
      try {
        const randomBatch = faker.helpers.arrayElement(batchYears);
        const email = faker.internet.email();
        
        // Check if email already exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) continue;
        
        const user = await prisma.user.create({
          data: {
            email,
            password: hashedPassword,
            firstName: faker.person.firstName(),
            lastName: faker.person.lastName(),
            fullName: faker.person.fullName(),
            role: 'USER',
            batch: randomBatch,
            rollNumber: this.generateRollNumber(randomBatch),
            phoneNumber: faker.phone.number(),
            whatsappNumber: Math.random() > 0.5 ? faker.phone.number() : null,
            isActive: true,
            emailVerified: Math.random() > 0.2, // 80% verified
            alumniVerified: Math.random() > 0.3, // 70% verified
            profileImage: Math.random() > 0.5 ? faker.image.avatar() : null,
            bio: Math.random() > 0.6 ? faker.lorem.paragraph() : null,
            currentCompany: Math.random() > 0.4 ? faker.company.name() : null,
            currentPosition: Math.random() > 0.4 ? faker.person.jobTitle() : null,
            location: Math.random() > 0.3 ? faker.location.city() : null
          }
        });
        
        this.createdData.users.push(user);
        userCount++;
      } catch (error) {
        // Skip if email collision or other issue
        continue;
      }
    }
    
    this.log(`   Created ${userCount} random alumni`, 'success');
  }

  async seedBatchAdminAssignments() {
    this.log('\n👑 Setting up Batch Admin Assignments...', 'info');
    
    const batchAdminYears = [2019, 2020, 2021, 2022];
    const superAdmin = this.createdData.users.find(u => u.role === 'SUPER_ADMIN');
    
    if (!superAdmin) {
      this.log('   ⚠️ No super admin found, skipping batch admin assignments', 'warning');
      return;
    }

    for (const year of batchAdminYears) {
      try {
        const batchAdmin = this.createdData.users.find(u => 
          u.email === `batchadmin${year}@test.com`
        );
        
        if (!batchAdmin) continue;

        await prisma.batchAdminAssignment.upsert({
          where: {
            userId_batchYear: {
              userId: batchAdmin.id,
              batchYear: year
            }
          },
          update: {
            isActive: true,
            assignedBy: superAdmin.id,
            assignedAt: new Date()
          },
          create: {
            userId: batchAdmin.id,
            batchYear: year,
            isActive: true,
            assignedBy: superAdmin.id,
            assignedAt: new Date()
          }
        });
        
        this.log(`   Assigned batch admin for ${year}`, 'success');
      } catch (error) {
        this.log(`   Failed to assign batch admin for ${year}: ${error.message}`, 'error');
      }
    }
  }

  async seedEventCategories() {
    this.log('\n🏷️ Seeding Event Categories...', 'info');
    
    const categories = [
      { name: 'Alumni Meetup', description: 'Regular alumni gathering events' },
      { name: 'Annual Conference', description: 'Yearly alumni conference' },
      { name: 'Workshop', description: 'Educational workshops and seminars' },
      { name: 'Sports Event', description: 'Sports and recreational activities' },
      { name: 'Cultural Event', description: 'Cultural programs and festivals' }
    ];

    for (const category of categories) {
      try {
        const eventCategory = await prisma.eventCategory.upsert({
          where: { name: category.name },
          update: {},
          create: {
            name: category.name,
            description: category.description,
            isActive: true
          }
        });
        
        this.createdData.categories.push(eventCategory);
        this.log(`   Created category: ${category.name}`, 'success');
      } catch (error) {
        this.log(`   Failed to create category ${category.name}: ${error.message}`, 'error');
      }
    }
  }

  async seedSampleEvents() {
    this.log('\n🎪 Seeding Sample Events...', 'info');
    
    const superAdmin = this.createdData.users.find(u => u.role === 'SUPER_ADMIN');
    const categories = this.createdData.categories;
    
    if (!superAdmin || categories.length === 0) {
      this.log('   ⚠️ Missing admin or categories, skipping events', 'warning');
      return;
    }

    const events = [
      {
        title: 'Annual Alumni Meetup 2025',
        description: 'Annual gathering of all batches',
        venue: 'College Campus',
        mode: 'OFFLINE',
        maxCapacity: 500,
        daysFromNow: 30
      },
      {
        title: 'Virtual Tech Talk Series',
        description: 'Monthly online tech sessions',
        venue: 'Zoom Meeting',
        mode: 'ONLINE',
        maxCapacity: 1000,
        daysFromNow: 15
      },
      {
        title: 'Batch 2020 Reunion',
        description: 'Exclusive reunion for 2020 batch',
        venue: 'City Hotel',
        mode: 'OFFLINE',
        maxCapacity: 100,
        daysFromNow: 45
      },
      {
        title: 'Alumni Sports Day',
        description: 'Sports and recreation event',
        venue: 'Sports Complex',
        mode: 'OFFLINE',
        maxCapacity: 200,
        daysFromNow: 60
      },
      {
        title: 'Hybrid Workshop Series',
        description: 'Professional development workshops',
        venue: 'Multiple Venues',
        mode: 'HYBRID',
        maxCapacity: 300,
        daysFromNow: 20
      }
    ];

    for (const eventData of events) {
      try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() + eventData.daysFromNow);
        
        const endDate = new Date(startDate);
        endDate.setHours(startDate.getHours() + 4); // 4-hour event
        
        const registrationStart = new Date();
        const registrationEnd = new Date(startDate);
        registrationEnd.setDate(registrationEnd.getDate() - 1); // Registration ends 1 day before

        const event = await prisma.event.create({
          data: {
            title: eventData.title,
            description: eventData.description,
            venue: eventData.venue,
            mode: eventData.mode,
            maxCapacity: eventData.maxCapacity,
            startsAt: startDate,
            endsAt: endDate,
            registrationStartsAt: registrationStart,
            registrationEndsAt: registrationEnd,
            status: 'PUBLISHED',
            createdBy: superAdmin.id,
            categoryId: faker.helpers.arrayElement(categories).id,
            registrationFee: faker.number.int({ min: 100, max: 1000 }),
            guestFee: faker.number.int({ min: 200, max: 500 }),
            slug: eventData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            coverImage: faker.image.url(),
            registrationPolicy: 'Anyone can register for this event',
            maxGuests: faker.number.int({ min: 2, max: 5 }),
            allowCancellation: true,
            cancellationPolicy: 'Free cancellation up to 24 hours before event'
          }
        });
        
        this.createdData.events.push(event);
        this.log(`   Created event: ${eventData.title}`, 'success');
      } catch (error) {
        this.log(`   Failed to create event ${eventData.title}: ${error.message}`, 'error');
      }
    }
  }

  async seedMembershipSettings() {
    this.log('\n💳 Seeding Membership Settings...', 'info');
    
    const superAdmin = this.createdData.users.find(u => u.role === 'SUPER_ADMIN');
    if (!superAdmin) return;

    // Create batch-specific membership settings
    const batchSettings = [
      { batchYear: 2020, fee: 200, description: 'Recent graduate fee' },
      { batchYear: 2021, fee: 200, description: 'Recent graduate fee' },
      { batchYear: 2022, fee: 200, description: 'Recent graduate fee' },
      { batchYear: 2015, fee: 500, description: 'Established alumni fee' },
      { batchYear: 2016, fee: 400, description: 'Mid-career alumni fee' },
      { batchYear: 2017, fee: 350, description: 'Mid-career alumni fee' },
      { batchYear: 2018, fee: 300, description: 'Professional alumni fee' },
      { batchYear: 2019, fee: 250, description: 'Early career alumni fee' }
    ];

    for (const setting of batchSettings) {
      try {
        await prisma.batchMembershipSettings.upsert({
          where: {
            batchYear_membershipYear: {
              batchYear: setting.batchYear,
              membershipYear: 2025
            }
          },
          update: {},
          create: {
            batchYear: setting.batchYear,
            membershipYear: 2025,
            membershipFee: setting.fee,
            description: setting.description,
            isActive: true,
            createdBy: superAdmin.id
          }
        });
        
        this.log(`   Set membership fee for batch ${setting.batchYear}: ₹${setting.fee}`, 'success');
      } catch (error) {
        this.log(`   Failed to set membership for batch ${setting.batchYear}: ${error.message}`, 'error');
      }
    }
  }

  async seedTreasuryData() {
    this.log('\n💰 Seeding Treasury Categories...', 'info');
    
    const expenseCategories = [
      {
        name: 'Event Expenses',
        description: 'All event-related expenses',
        subcategories: ['Venue Booking', 'Catering', 'Decoration', 'Audio/Video']
      },
      {
        name: 'Administrative',
        description: 'Administrative and operational expenses',
        subcategories: ['Office Supplies', 'Software Licenses', 'Utilities', 'Communication']
      },
      {
        name: 'Marketing',
        description: 'Marketing and promotional expenses',
        subcategories: ['Social Media Ads', 'Print Materials', 'Website', 'Branding']
      }
    ];

    for (const category of expenseCategories) {
      try {
        const expenseCategory = await prisma.treasuryExpenseCategory.upsert({
          where: { name: category.name },
          update: {},
          create: {
            name: category.name,
            description: category.description,
            isActive: true,
            orderIndex: expenseCategories.indexOf(category) + 1
          }
        });

        // Create subcategories
        for (const subcatName of category.subcategories) {
          await prisma.treasuryExpenseSubcategory.upsert({
            where: { name: subcatName },
            update: {},
            create: {
              name: subcatName,
              description: `${subcatName} related expenses`,
              categoryId: expenseCategory.id,
              isActive: true,
              orderIndex: category.subcategories.indexOf(subcatName) + 1
            }
          });
        }
        
        this.log(`   Created expense category: ${category.name} with ${category.subcategories.length} subcategories`, 'success');
      } catch (error) {
        this.log(`   Failed to create category ${category.name}: ${error.message}`, 'error');
      }
    }
  }

  async seedTicketCategories() {
    this.log('\n🎫 Seeding Ticket Categories...', 'info');
    
    const ticketCategories = [
      { name: 'Technical Support', description: 'Technical issues and bugs', priority: 'HIGH' },
      { name: 'Account Issues', description: 'Profile and account related problems', priority: 'MEDIUM' },
      { name: 'Event Support', description: 'Event registration and participation issues', priority: 'HIGH' },
      { name: 'Payment Issues', description: 'Payment and billing problems', priority: 'HIGH' },
      { name: 'General Inquiry', description: 'General questions and feedback', priority: 'LOW' }
    ];

    for (const category of ticketCategories) {
      try {
        await prisma.ticketCategory.upsert({
          where: { name: category.name },
          update: {},
          create: {
            name: category.name,
            description: category.description,
            defaultPriority: category.priority,
            isActive: true,
            orderIndex: ticketCategories.indexOf(category) + 1
          }
        });
        
        this.log(`   Created ticket category: ${category.name}`, 'success');
      } catch (error) {
        this.log(`   Failed to create ticket category ${category.name}: ${error.message}`, 'error');
      }
    }
  }

  // =============================================
  // MAIN SEEDING PROCESS
  // =============================================

  async runSeeding() {
    console.log('\n🚀 Starting Database Seeding Process'.rainbow.bold);
    console.log('='.repeat(50).cyan);
    
    const startTime = Date.now();

    try {
      // Seed in specific order due to dependencies
      await this.seedBatches();
      await this.seedUsers();
      await this.seedBatchAdminAssignments();
      await this.seedEventCategories();
      await this.seedSampleEvents();
      await this.seedMembershipSettings();
      await this.seedTreasuryData();
      await this.seedTicketCategories();

      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);

      this.generateSeedingReport(duration);
      
    } catch (error) {
      this.log(`🚨 CRITICAL SEEDING ERROR: ${error.message}`, 'error');
      throw error;
    } finally {
      await prisma.$disconnect();
    }
  }

  generateSeedingReport(duration) {
    console.log('\n📊 SEEDING COMPLETE REPORT'.rainbow.bold);
    console.log('='.repeat(50).cyan);
    
    console.log('\n📈 SEEDED DATA SUMMARY:'.yellow.bold);
    console.log(`   Users Created: ${this.createdData.users.length}`.white);
    console.log(`   Batches Created: ${this.createdData.batches.length}`.white);
    console.log(`   Events Created: ${this.createdData.events.length}`.white);
    console.log(`   Categories Created: ${this.createdData.categories.length}`.white);
    console.log(`   Duration: ${duration} seconds`.gray);

    console.log('\n🔑 TEST CREDENTIALS:'.green.bold);
    console.log('   Super Admin: admin@test.com / TestPassword123!'.green);
    console.log('   Regular User: user@test.com / TestPassword123!'.green);
    console.log('   Batch Admins:'.green);
    console.log('     - batchadmin2019@test.com / TestPassword123!'.white);
    console.log('     - batchadmin2020@test.com / TestPassword123!'.white);
    console.log('     - batchadmin2021@test.com / TestPassword123!'.white);
    console.log('     - batchadmin2022@test.com / TestPassword123!'.white);

    console.log('\n🎯 READY FOR TESTING:'.blue.bold);
    console.log('   ✅ Run: node testing/01-auth-system.js'.white);
    console.log('   ✅ All test credentials are ready'.white);
    console.log('   ✅ Realistic data relationships established'.white);

    console.log(`\n${'='.repeat(50)}`.cyan);
    console.log('🌱 Database Seeding Complete'.rainbow.bold);
  }
}

// =============================================
// EXECUTION
// =============================================

async function main() {
  console.log('🎯 PHASE 0: DATABASE SEEDING FOR TESTING'.rainbow.bold);
  console.log('Creating realistic test data following PDF plan'.gray);
  console.log('='.repeat(60).cyan);

  const seeder = new DatabaseSeeder();
  await seeder.runSeeding();
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('🚨 SEEDING FAILED:'.red.bold, error.message);
    process.exit(1);
  });
}

module.exports = DatabaseSeeder;