// Script to populate reaction counts for existing posts
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migrateReactionCounts() {
  console.log('🔄 Starting reaction counts migration...');
  
  try {
    // Get all posts
    const posts = await prisma.post.findMany({
      include: {
        likes: true
      }
    });

    console.log(`📊 Found ${posts.length} posts to migrate`);

    for (const post of posts) {
      // Count reactions by type
      const reactionCounts = {
        likeCount: 0,
        loveCount: 0,
        celebrateCount: 0,
        supportCount: 0,
        funnyCount: 0,
        wowCount: 0,
        angryCount: 0,
        sadCount: 0,
      };

      // Count each reaction type
      post.likes.forEach(like => {
        switch(like.reactionType) {
          case 'LIKE':
            reactionCounts.likeCount++;
            break;
          case 'LOVE':
            reactionCounts.loveCount++;
            break;
          case 'CELEBRATE':
            reactionCounts.celebrateCount++;
            break;
          case 'SUPPORT':
            reactionCounts.supportCount++;
            break;
          case 'FUNNY':
            reactionCounts.funnyCount++;
            break;
          case 'WOW':
            reactionCounts.wowCount++;
            break;
          case 'ANGRY':
            reactionCounts.angryCount++;
            break;
          case 'SAD':
            reactionCounts.sadCount++;
            break;
        }
      });

      // Calculate total reactions
      const totalReactions = Object.values(reactionCounts).reduce((sum, count) => sum + count, 0);

      // Update the post with reaction counts
      await prisma.post.update({
        where: { id: post.id },
        data: {
          ...reactionCounts,
          totalReactions
        }
      });

      console.log(`✅ Updated post ${post.id}: ${totalReactions} total reactions`);
    }

    console.log('🎉 Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateReactionCounts().catch(console.error);