import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  try {
    const deleted = await prisma.videoAsset.deleteMany({});
    console.log(`Successfully deleted ${deleted.count} video assets.`);
  } catch (error) {
    console.error("Error clearing video assets:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
