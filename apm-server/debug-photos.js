// Debug script to check photo data in database
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPhotos() {
  try {
    const photos = await prisma.photo.findMany({
      where: {
        albumId: 'cmiys7mr40007vvkt8pl8yfhy'
      },
      select: {
        id: true,
        url: true,
        metadata: true
      },
      take: 3
    });

    console.log('\n========= PHOTO DATA ==========\n');
    photos.forEach((photo, index) => {
      console.log(`Photo ${index + 1}:`);
      console.log('  ID:', photo.id);
      console.log('  URL:', photo.url);
      console.log('  Metadata:', JSON.stringify(photo.metadata, null, 2));
      console.log('---');
    });
    console.log('\n===============================\n');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPhotos();
