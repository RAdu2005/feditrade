import { jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET() {
  await prisma.$queryRaw`SELECT 1`;
  return jsonOk({
    status: "ok",
    service: "web",
    timestamp: new Date().toISOString(),
  });
}
