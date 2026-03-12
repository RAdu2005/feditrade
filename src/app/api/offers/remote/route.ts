import { requireUserWithReason } from "@/lib/auth-helpers";
import { jsonCreated, jsonError } from "@/lib/http";
import { sendOutboundMarketplaceOffer } from "@/lib/marketplace-outbound-offer-service";
import { outboundMarketplaceOfferSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const { user, reason } = await requireUserWithReason();
  if (!user) {
    if (reason === "STALE_SESSION") {
      return jsonError("Session is stale. Please sign in again.", 401);
    }

    return jsonError("Unauthorized", 401);
  }

  const payload = (await request.json().catch(() => null)) as unknown;
  const parsed = outboundMarketplaceOfferSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonError("Invalid offer payload", 400, parsed.error.flatten());
  }

  try {
    const result = await sendOutboundMarketplaceOffer(user.id, {
      targetProposalId: parsed.data.targetProposalId,
      targetActorId: parsed.data.targetActorId,
      targetInbox: parsed.data.targetInbox,
      note: parsed.data.note,
      quantity: parsed.data.quantity,
      unitCode: parsed.data.unitCode,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
    });

    return jsonCreated(result);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to send outbound offer", 502);
  }
}
