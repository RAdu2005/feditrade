import { requireUserWithReason } from "@/lib/auth-helpers";
import { completeMarketplaceAgreement } from "@/lib/marketplace-offer-service";
import { jsonError, jsonOk } from "@/lib/http";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(_: Request, context: Params) {
  const { user, reason } = await requireUserWithReason();
  if (!user) {
    if (reason === "STALE_SESSION") {
      return jsonError("Session is stale. Please sign in again.", 401);
    }
    return jsonError("Unauthorized", 401);
  }

  const { id } = await context.params;
  try {
    const result = await completeMarketplaceAgreement(id, user.id);
    if (!result) {
      return jsonError("Agreement not found", 404);
    }

    return jsonOk(result);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to complete agreement", 400);
  }
}
