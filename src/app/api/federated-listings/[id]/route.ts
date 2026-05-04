import { getFederatedListingById } from "@/lib/federation-tracking-service";
import { jsonError, jsonOk } from "@/lib/http";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, context: Params) {
  const { id } = await context.params;
  const listing = await getFederatedListingById(id);
  if (!listing) {
    return jsonError("Federated listing not found", 404);
  }

  return jsonOk(listing);
}
