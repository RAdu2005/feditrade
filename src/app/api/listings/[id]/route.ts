import { getListingById, updateListing, deleteListing } from "@/lib/listing-service";
import { requireUserWithReason } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import { listingUpdateSchema } from "@/lib/validators";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, context: Params) {
  const { id } = await context.params;
  const listing = await getListingById(id);
  if (!listing) {
    return jsonError("Listing not found", 404);
  }

  return jsonOk(listing);
}

export async function PATCH(request: Request, context: Params) {
  const { id } = await context.params;
  const { user, reason } = await requireUserWithReason();
  if (!user) {
    if (reason === "STALE_SESSION") {
      return jsonError("Session is stale. Please sign in again.", 401);
    }
    return jsonError("Unauthorized", 401);
  }

  const payload = await request.json().catch(() => null);
  const parsed = listingUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonError("Invalid update payload", 400, parsed.error.flatten());
  }

  const listing = await updateListing(id, user.id, parsed.data);
  if (!listing) {
    return jsonError("Listing not found", 404);
  }

  return jsonOk(listing);
}

export async function DELETE(_: Request, context: Params) {
  const { id } = await context.params;
  const { user, reason } = await requireUserWithReason();
  if (!user) {
    if (reason === "STALE_SESSION") {
      return jsonError("Session is stale. Please sign in again.", 401);
    }
    return jsonError("Unauthorized", 401);
  }

  const listing = await deleteListing(id, user.id);
  if (!listing) {
    return jsonError("Listing not found", 404);
  }

  return jsonOk(listing);
}
