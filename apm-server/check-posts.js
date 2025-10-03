const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkPosts() {
  try {
    console.log('🔍 Checking posts in database...\n');
    
    const posts = await prisma.post.findMany({
      select: {
        id: true,
        title: true,
        isPublished: true,
        isArchived: true,
        likeCount: true,
        loveCount: true,
        celebrateCount: true,
        supportCount: true,
        funnyCount: true,
        wowCount: true,
        angryCount: true,
        sadCount: true,
        totalReactions: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`📊 Found ${posts.length} posts:\n`);
    
    posts.forEach((post, index) => {
      console.log(`${index + 1}. Post ID: ${post.id}`);
      console.log(`   Title: ${post.title.substring(0, 50)}...`);
      console.log(`   Published: ${post.isPublished}`);
      console.log(`   Archived: ${post.isArchived}`);
      console.log(`   Reaction Counts:`);
      console.log(`     LIKE: ${post.likeCount}, LOVE: ${post.loveCount}, CELEBRATE: ${post.celebrateCount}`);
      console.log(`     SUPPORT: ${post.supportCount}, FUNNY: ${post.funnyCount}, WOW: ${post.wowCount}`);
      console.log(`     ANGRY: ${post.angryCount}, SAD: ${post.sadCount}`);
      console.log(`     TOTAL: ${post.totalReactions}`);
      console.log(`   Created: ${post.createdAt}\n`);
    });
    
    // Check reactions
    const reactions = await prisma.like.findMany({
      select: {
        id: true,
        postId: true,
        userId: true,
        reactionType: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`🎯 Found ${reactions.length} reactions:\n`);
    
    reactions.forEach((reaction, index) => {
      console.log(`${index + 1}. Reaction ID: ${reaction.id}`);
      console.log(`   Post ID: ${reaction.postId}`);
      console.log(`   User ID: ${reaction.userId}`);
      console.log(`   Type: ${reaction.reactionType}`);
      console.log(`   Created: ${reaction.createdAt}\n`);
    });
    
  } catch (error) {
    console.error('❌ Error checking posts:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPosts();