import { requireUser } from "@/lib/auth-helpers";
import { jsonCreated, jsonError } from "@/lib/http";
import { createSignedUploadUrl, getPublicObjectUrl } from "@/lib/s3";
import { signUploadSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) {
    return jsonError("Unauthorized", 401);
  }

  const payload = await request.json().catch(() => null);
  const parsed = signUploadSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonError("Invalid upload request", 400, parsed.error.flatten());
  }

  const signed = await createSignedUploadUrl({
    contentType: parsed.data.contentType,
    maxSizeBytes: parsed.data.sizeBytes,
  });

  return jsonCreated({
    uploadUrl: signed.url,
    key: signed.key,
    publicUrl: getPublicObjectUrl(signed.key),
  });
}
