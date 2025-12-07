// fix-donation-counts.js
// Script to recalculate totalBloodDonations and totalUnitsDonated from actual donation records

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixDonationCounts() {
  try {
    console.log('🔧 Starting donation count recalculation...\n');

    // Get all users who have donation records
    const usersWithDonations = await prisma.user.findMany({
      where: {
        donationHistory: {
          some: {}
        }
      },
      include: {
        donationHistory: {
          select: {
            id: true,
            units: true,
            donationDate: true
          }
        }
      }
    });

    console.log(`Found ${usersWithDonations.length} users with donation records\n`);

    let updatedCount = 0;

    for (const user of usersWithDonations) {
      // Calculate correct totals from actual donation records
      const totalDonationEvents = user.donationHistory.length;
      const totalUnits = user.donationHistory.reduce((sum, donation) => sum + donation.units, 0);

      // Find the most recent donation date
      const sortedDonations = user.donationHistory.sort((a, b) =>
        new Date(b.donationDate) - new Date(a.donationDate)
      );
      const lastDonationDate = sortedDonations[0]?.donationDate;

      console.log(`📊 User: ${user.fullName || user.email}`);
      console.log(`   Old: totalBloodDonations=${user.totalBloodDonations}, totalUnitsDonated=${user.totalUnitsDonated}`);
      console.log(`   New: totalBloodDonations=${totalDonationEvents}, totalUnitsDonated=${totalUnits}`);
      console.log(`   Donations: ${user.donationHistory.length} events`);
      console.log(`   Units breakdown: ${user.donationHistory.map(d => d.units).join(' + ')} = ${totalUnits}\n`);

      // Update user record with correct counts
      await prisma.user.update({
        where: { id: user.id },
        data: {
          totalBloodDonations: totalDonationEvents,
          totalUnitsDonated: totalUnits,
          lastBloodDonationDate: lastDonationDate
        }
      });

      updatedCount++;
    }

    console.log(`\n✅ Successfully recalculated donation counts for ${updatedCount} users`);

  } catch (error) {
    console.error('❌ Error fixing donation counts:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
fixDonationCounts()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });
