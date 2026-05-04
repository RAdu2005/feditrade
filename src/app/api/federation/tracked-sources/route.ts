import { requireUserWithReason } from "@/lib/auth-helpers";
import {
  listTrackedSourcesWithActiveListings,
  trackSourceFromInput,
} from "@/lib/federation-tracking-service";
import { jsonCreated, jsonError, jsonOk } from "@/lib/http";
import { trackedSourceSchema } from "@/lib/validators";

export async function GET() {
  const sources = await listTrackedSourcesWithActiveListings();
  return jsonOk({ items: sources });
}

export async function POST(request: Request) {
  const { user, reason } = await requireUserWithReason();
  if (!user) {
    if (reason === "STALE_SESSION") {
      return jsonError("Session is stale. Please sign in again.", 401);
    }

    return jsonError("Unauthorized", 401);
  }

  const payload = (await request.json().catch(() => null)) as unknown;
  const parsed = trackedSourceSchema.safeParse(payload ?? {});
  if (!parsed.success) {
    return jsonError("Invalid tracking source payload", 400, parsed.error.flatten());
  }

  try {
    const result = await trackSourceFromInput(user.id, parsed.data.source);
    return jsonCreated({
      trackedSourceId: result.trackedInstance.id,
      domain: result.trackedInstance.domain,
      followStatus: result.trackedInstance.followStatus,
      importedListingId: result.importedListing?.id ?? null,
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Failed to track source", 400);
  }
}
