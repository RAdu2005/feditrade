import { requireAdmin } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import { prisma } from "@/lib/prisma";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(_: Request, context: Params) {
  const admin = await requireAdmin();
  if (!admin) {
    return jsonError("Forbidden", 403);
  }

  const { id } = await context.params;
  const listing = await prisma.listing.update({
    where: { id },
    data: {
      status: "REMOVED",
    },
  });

  await prisma.adminAction.create({
    data: {
      adminUserId: admin.id,
      actionType: "TAKE_DOWN_LISTING",
      targetId: id,
      targetType: "Listing",
      details: {
        status: listing.status,
      },
    },
  });

  return jsonOk({ listing });
}
