import { Prisma } from "@prisma/client";
import { childLogger } from "@/lib/logger";
import { jsonCreated, jsonError, jsonOk } from "@/lib/http";
import { createListing, listPublicListings } from "@/lib/listing-service";
import { requireUserWithReason } from "@/lib/auth-helpers";
import { listingCreateSchema } from "@/lib/validators";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const limit = Number(url.searchParams.get("limit") ?? "20");

  const result = await listPublicListings({ cursor, limit });
  return jsonOk(result);
}

export async function POST(request: Request) {
  const logger = childLogger({ route: "POST /api/listings" });
  const { user, reason } = await requireUserWithReason();
  if (!user) {
    if (reason === "STALE_SESSION") {
      return jsonError("Session is stale. Please sign in again.", 401);
    }
    return jsonError("Unauthorized", 401);
  }

  const payload = await request.json().catch(() => null);
  const parsed = listingCreateSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonError("Invalid listing payload", 400, parsed.error.flatten());
  }

  try {
    const listing = await createListing(user.id, parsed.data);
    return jsonCreated(listing);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return jsonError("Session is stale. Please sign in again.", 401);
    }
    logger.error({ err: error }, "Failed to create listing");
    return jsonError("Failed to create listing", 500);
  }
}
