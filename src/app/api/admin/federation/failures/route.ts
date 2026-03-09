import { requireAdmin } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return jsonError("Forbidden", 403);
  }

  const jobs = await prisma.federationDeliveryJob.findMany({
    where: {
      status: "DEAD_LETTER",
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: 100,
  });

  return jsonOk({
    jobs,
  });
}
