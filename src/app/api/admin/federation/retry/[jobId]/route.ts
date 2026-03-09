import { requireAdmin } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import { retryDeadLetterJob } from "@/lib/delivery-queue";
import { prisma } from "@/lib/prisma";

type Params = {
  params: Promise<{ jobId: string }>;
};

export async function POST(_: Request, context: Params) {
  const admin = await requireAdmin();
  if (!admin) {
    return jsonError("Forbidden", 403);
  }

  const { jobId } = await context.params;
  const job = await retryDeadLetterJob(jobId);

  await prisma.adminAction.create({
    data: {
      adminUserId: admin.id,
      actionType: "RETRY_JOB",
      targetId: jobId,
      targetType: "FederationDeliveryJob",
      details: {
        previousStatus: "DEAD_LETTER",
      },
    },
  });

  return jsonOk({ job });
}
