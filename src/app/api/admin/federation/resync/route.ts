import { requireAdmin } from "@/lib/auth-helpers";
import { jsonError, jsonOk } from "@/lib/http";
import { resyncFederationForAllListings } from "@/lib/listing-service";

export async function POST() {
  const admin = await requireAdmin();
  if (!admin) {
    return jsonError("Forbidden", 403);
  }

  const result = await resyncFederationForAllListings();
  return jsonOk({
    syncedBy: admin.id,
    ...result,
  });
}
