import { listFederatedListings } from "@/lib/federation-tracking-service";
import { jsonOk } from "@/lib/http";

export async function GET() {
  const items = await listFederatedListings();
  return jsonOk({ items });
}
