// prisma/seed-developer.js
// Seed script for Developer account and Subscription Plans/Features

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Default Features for Alumni Portal
// Note: Uses isCore for core features instead of sortOrder (not in schema)
const DEFAULT_FEATURES = [
  // Core Features (included in all plans)
  { code: 'DASHBOARD', name: 'Dashboard', description: 'Basic dashboard access', category: 'CORE', isCore: true, isPremium: false },
  { code: 'PROFILE', name: 'User Profile', description: 'User profile management', category: 'CORE', isCore: true, isPremium: false },
  { code: 'DIRECTORY', name: 'Alumni Directory', description: 'View alumni directory', category: 'CORE', isCore: true, isPremium: false },

  // Social Features
  { code: 'POSTS', name: 'Posts & Feed', description: 'Create and view posts', category: 'SOCIAL', isCore: false, isPremium: false },
  { code: 'POLLS', name: 'Polls', description: 'Create and participate in polls', category: 'SOCIAL', isCore: false, isPremium: false },
  { code: 'GROUPS', name: 'Groups', description: 'Create and manage groups', category: 'SOCIAL', isCore: false, isPremium: true },

  // Event Features
  { code: 'EVENTS', name: 'Events', description: 'View and register for events', category: 'EVENTS', isCore: false, isPremium: false },
  { code: 'EVENT_MANAGEMENT', name: 'Event Management', description: 'Create and manage events', category: 'EVENTS', isCore: false, isPremium: true },
  { code: 'EVENT_TICKETING', name: 'Event Ticketing', description: 'QR code ticketing for events', category: 'EVENTS', isCore: false, isPremium: true },

  // Gallery Features
  { code: 'GALLERY', name: 'Photo Gallery', description: 'View photo albums', category: 'GALLERY', isCore: false, isPremium: false },
  { code: 'GALLERY_MANAGEMENT', name: 'Gallery Management', description: 'Create and manage albums', category: 'GALLERY', isCore: false, isPremium: true },

  // Financial Features
  { code: 'TREASURY', name: 'Treasury', description: 'View treasury and transactions', category: 'FINANCIAL', isCore: false, isPremium: true },
  { code: 'DONATIONS', name: 'Donations', description: 'Accept donations', category: 'FINANCIAL', isCore: false, isPremium: true },
  { code: 'MEMBERSHIP_FEES', name: 'Membership Fees', description: 'Collect membership fees', category: 'FINANCIAL', isCore: false, isPremium: true },

  // Support Features
  { code: 'SUPPORT_TICKETS', name: 'Support Tickets', description: 'Support ticket system', category: 'SUPPORT', isCore: false, isPremium: true },
  { code: 'LIFELINK', name: 'LifeLink', description: 'Blood donation and emergency help', category: 'SUPPORT', isCore: false, isPremium: true },

  // Admin Features
  { code: 'USER_MANAGEMENT', name: 'User Management', description: 'Manage users and roles', category: 'ADMIN', isCore: false, isPremium: true },
  { code: 'ANALYTICS', name: 'Analytics', description: 'View analytics and reports', category: 'ADMIN', isCore: false, isPremium: true },
  { code: 'NOTIFICATIONS', name: 'Push Notifications', description: 'Send push notifications', category: 'ADMIN', isCore: false, isPremium: true },
  { code: 'EMAIL_CAMPAIGNS', name: 'Email Campaigns', description: 'Send bulk emails', category: 'ADMIN', isCore: false, isPremium: true },

  // Advanced Features
  { code: 'MERCHANDISE', name: 'Merchandise Store', description: 'Sell merchandise', category: 'ADVANCED', isCore: false, isPremium: true },
  { code: 'CUSTOM_BRANDING', name: 'Custom Branding', description: 'Custom logo and colors', category: 'ADVANCED', isCore: false, isPremium: true },
  { code: 'API_ACCESS', name: 'API Access', description: 'REST API access', category: 'ADVANCED', isCore: false, isPremium: true },
];

// Default Subscription Plans
const DEFAULT_PLANS = [
  {
    code: 'FREE',
    name: 'Free',
    description: 'Basic features for small alumni groups',
    priceMonthly: 0,
    priceYearly: 0,
    maxUsers: 100,
    maxStorageMB: 1024, // 1GB
    features: ['DASHBOARD', 'PROFILE', 'DIRECTORY', 'POSTS', 'POLLS', 'EVENTS', 'GALLERY'],
    isActive: true,
    sortOrder: 1,
  },
  {
    code: 'STARTER',
    name: 'Starter',
    description: 'Essential features for growing alumni networks',
    priceMonthly: 999,
    priceYearly: 9990, // ~17% discount
    maxUsers: 500,
    maxStorageMB: 5120, // 5GB
    features: ['DASHBOARD', 'PROFILE', 'DIRECTORY', 'POSTS', 'POLLS', 'EVENTS', 'GALLERY',
               'GROUPS', 'EVENT_MANAGEMENT', 'GALLERY_MANAGEMENT', 'SUPPORT_TICKETS'],
    isActive: true,
    sortOrder: 2,
  },
  {
    code: 'PROFESSIONAL',
    name: 'Professional',
    description: 'Full-featured plan for active alumni associations',
    priceMonthly: 2499,
    priceYearly: 24990, // ~17% discount
    maxUsers: 2000,
    maxStorageMB: 20480, // 20GB
    features: ['DASHBOARD', 'PROFILE', 'DIRECTORY', 'POSTS', 'POLLS', 'EVENTS', 'GALLERY',
               'GROUPS', 'EVENT_MANAGEMENT', 'EVENT_TICKETING', 'GALLERY_MANAGEMENT',
               'TREASURY', 'DONATIONS', 'MEMBERSHIP_FEES', 'SUPPORT_TICKETS', 'LIFELINK',
               'USER_MANAGEMENT', 'ANALYTICS', 'NOTIFICATIONS'],
    isActive: true,
    sortOrder: 3,
  },
  {
    code: 'ENTERPRISE',
    name: 'Enterprise',
    description: 'Complete solution for large alumni organizations',
    priceMonthly: 4999,
    priceYearly: 49990, // ~17% discount
    maxUsers: 10000,
    maxStorageMB: 102400, // 100GB
    features: DEFAULT_FEATURES.map(f => f.code), // All features
    isActive: true,
    sortOrder: 4,
  },
];

async function main() {
  console.log('🌱 Starting Developer & Subscription Seed...\n');

  // 0. Create Local Development Organization (for LOCAL-DEV code)
  console.log('🏢 Creating Local Development Organization...');
  const devOrg = await prisma.organization.upsert({
    where: { tenantCode: 'LOCAL-DEV' },
    update: {},
    create: {
      name: 'Local Development',
      shortName: 'LOCALDEV',
      tenantCode: 'LOCAL-DEV',
      foundationYear: 2024,
      officialEmail: 'developer@guild.local',
      description: 'Local development organization for testing',
      isActive: true,
    },
  });
  console.log(`   ✅ Organization: ${devOrg.name} (Code: ${devOrg.tenantCode})\n`);

  // 1. Create a default Batch (required for User foreign key)
  console.log('📅 Creating Default Batch...');

  // Check if batch 2024 exists, if not create one
  let defaultBatch = await prisma.batch.findUnique({
    where: { year: 2024 }
  });

  if (!defaultBatch) {
    defaultBatch = await prisma.batch.create({
      data: {
        year: 2024,
        name: 'System Users 2024',
        description: 'Default batch for system users (Developer, etc.)',
        totalMembers: 0,
      },
    });
  }
  console.log(`   ✅ Default Batch: ${defaultBatch.name} (Year: ${defaultBatch.year})\n`);

  // 2. Create Developer User
  console.log('👨‍💻 Creating Developer Account...');
  const hashedPassword = await bcrypt.hash('Developer@123', 12);

  // Check if developer already exists (by email + org composite key)
  let developer = await prisma.user.findFirst({
    where: {
      email: 'developer@guild.com',
      organizationId: devOrg.id,
    }
  });

  if (!developer) {
    developer = await prisma.user.create({
      data: {
        email: 'developer@guild.com',
        passwordHash: hashedPassword,
        fullName: 'GUILD Developer',
        role: 'DEVELOPER',
        batch: 2024,
        isEmailVerified: true,
        isAlumniVerified: true,
        pendingVerification: false,
        isActive: true,
        organizationId: devOrg.id,
      },
    });
    console.log(`   ✅ Developer Created: ${developer.email} (ID: ${developer.id})`);
  } else {
    console.log(`   ✅ Developer Exists: ${developer.email} (ID: ${developer.id})`);
  }
  console.log(`   📧 Email: developer@guild.com`);
  console.log(`   🔑 Password: Developer@123`);
  console.log(`   🏢 Organization: ${devOrg.name} (${devOrg.tenantCode})\n`);

  // 2. Create Features
  console.log('🎯 Creating Feature Catalog...');
  for (const feature of DEFAULT_FEATURES) {
    await prisma.feature.upsert({
      where: { code: feature.code },
      update: feature,
      create: feature,
    });
  }
  console.log(`   ✅ Created ${DEFAULT_FEATURES.length} features\n`);

  // 3. Create Subscription Plans
  console.log('💳 Creating Subscription Plans...');
  const createdPlans = [];

  for (const planData of DEFAULT_PLANS) {
    const { features, ...plan } = planData;

    const createdPlan = await prisma.subscriptionPlan.upsert({
      where: { code: plan.code },
      update: {
        ...plan,
        includedFeatures: features,
      },
      create: {
        ...plan,
        includedFeatures: features,
      },
    });

    createdPlans.push({ plan: createdPlan, features });
    console.log(`   ✅ ${plan.name}: ₹${plan.priceMonthly}/mo or ₹${plan.priceYearly}/yr (${features.length} features)`);
  }

  // 4. Create Plan Feature Overrides (for feature limits per plan)
  console.log('\n🔧 Setting up Plan Feature Limits...');

  // Example: Set user limits per plan
  const planLimits = {
    'FREE': { 'POSTS': 10, 'EVENTS': 2, 'GALLERY': 100 }, // posts per month, events per month, photos
    'STARTER': { 'POSTS': 50, 'EVENTS': 10, 'GALLERY': 500 },
    'PROFESSIONAL': { 'POSTS': 200, 'EVENTS': 50, 'GALLERY': 2000 },
    'ENTERPRISE': { 'POSTS': -1, 'EVENTS': -1, 'GALLERY': -1 }, // unlimited
  };

  for (const [planCode, limits] of Object.entries(planLimits)) {
    const plan = await prisma.subscriptionPlan.findUnique({ where: { code: planCode } });
    if (plan) {
      for (const [featureCode, limit] of Object.entries(limits)) {
        const feature = await prisma.feature.findUnique({ where: { code: featureCode } });
        if (feature) {
          await prisma.planFeatureOverride.upsert({
            where: {
              planId_featureId: { planId: plan.id, featureId: feature.id }
            },
            update: { limit: limit },
            create: {
              planId: plan.id,
              featureId: feature.id,
              limit: limit,
            },
          });
        }
      }
    }
  }
  console.log('   ✅ Plan feature limits configured\n');

  // Summary
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                    🎉 SEED COMPLETED SUCCESSFULLY!             ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('\n🏢 DEVELOPER ORGANIZATION:');
  console.log('   Name:     Local Development');
  console.log('   Code:     LOCAL-DEV');
  console.log('\n📋 DEVELOPER CREDENTIALS:');
  console.log('   Email:    developer@guild.com');
  console.log('   Password: Developer@123');
  console.log('   Role:     DEVELOPER');
  console.log('\n💳 SUBSCRIPTION PLANS CREATED:');
  console.log('   1. Free      - ₹0/month    (100 users, 1GB storage)');
  console.log('   2. Starter   - ₹999/month  (500 users, 5GB storage)');
  console.log('   3. Professional - ₹2,499/month (2,000 users, 20GB storage)');
  console.log('   4. Enterprise - ₹4,999/month (10,000 users, 100GB storage)');
  console.log('\n🎯 FEATURES CREATED: ' + DEFAULT_FEATURES.length);
  console.log('\n📌 HOW TO LOGIN AS DEVELOPER:');
  console.log('   1. Start the server: npm run dev');
  console.log('   2. Go to login page');
  console.log('   3. Enter email: developer@guild.com');
  console.log('   4. On org selection step, enter code: LOCAL-DEV');
  console.log('   5. Enter password: Developer@123');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
