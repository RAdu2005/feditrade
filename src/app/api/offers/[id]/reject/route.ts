import { requireUserWithReason } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import { rejectMarketplaceOffer } from "@/lib/marketplace-offer-service";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: Params) {
  const { user, reason } = await requireUserWithReason();
  if (!user) {
    if (reason === "STALE_SESSION") {
      return jsonError("Session is stale. Please sign in again.", 401);
    }
    return jsonError("Unauthorized", 401);
  }

  const payload = (await request.json().catch(() => ({}))) as { reason?: string };
  const { id } = await context.params;
  try {
    const result = await rejectMarketplaceOffer(id, user.id, payload.reason);
    if (!result) {
      return jsonError("Offer not found", 404);
    }

    return jsonOk(result);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to reject offer", 400);
  }
}
