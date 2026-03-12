import { requireUserWithReason } from "@/lib/auth-helpers";
import { jsonCreated, jsonError } from "@/lib/http";
import { sendOutboundMarketplaceOfferForListing } from "@/lib/marketplace-outbound-offer-service";
import { listingMarketplaceOfferSchema } from "@/lib/validators";

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

  const payload = (await request.json().catch(() => null)) as unknown;
  const parsed = listingMarketplaceOfferSchema.safeParse(payload ?? {});
  if (!parsed.success) {
    return jsonError("Invalid offer payload", 400, parsed.error.flatten());
  }

  const { id } = await context.params;

  try {
    const offer = await sendOutboundMarketplaceOfferForListing(user.id, id, {
      note: parsed.data.note,
      quantity: parsed.data.quantity,
      unitCode: parsed.data.unitCode,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
    });

    if (!offer) {
      return jsonError("Listing or proposal not found", 404);
    }

    return jsonCreated(offer);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to send offer", 400);
  }
}
