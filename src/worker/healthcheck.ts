import "dotenv/config";
import { prisma } from "@/lib/prisma";

async function check() {
  await prisma.$queryRaw`SELECT 1`;
  await prisma.$disconnect();
}

check()
  .then(() => {
    process.exit(0);
  })
  .catch(() => {
    process.exit(1);
  });
