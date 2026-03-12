import { requireUserWithReason } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import { acceptMarketplaceOffer } from "@/lib/marketplace-offer-service";

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
    const result = await acceptMarketplaceOffer(id, user.id);
    if (!result) {
      return jsonError("Offer not found", 404);
    }

    return jsonOk(result);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to accept offer", 400);
  }
}
