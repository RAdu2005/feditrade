import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { requireUserWithReason } from "@/lib/auth-helpers";
import { env } from "@/lib/env";
import { jsonCreated, jsonError } from "@/lib/http";
import { buildObjectKey, getPublicObjectUrl, putObject } from "@/lib/s3";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxSizeBytes = 5 * 1024 * 1024;

function extensionFromType(contentType: string) {
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "bin";
}

async function saveToLocalDisk(contentType: string, data: Buffer) {
  const datePath = new Date().toISOString().slice(0, 10);
  const fileName = `${randomUUID()}.${extensionFromType(contentType)}`;
  const relativePath = path.join("uploads", datePath, fileName);
  const absolutePath = path.join(process.cwd(), "public", relativePath);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, data);

  const publicUrl = `${env.APP_BASE_URL.replace(/\/+$/, "")}/${relativePath.replaceAll("\\", "/")}`;
  return {
    key: publicUrl,
    publicUrl,
    storage: "local",
  } as const;
}

export async function POST(request: Request) {
  const { user, reason } = await requireUserWithReason();
  if (!user) {
    if (reason === "STALE_SESSION") {
      return jsonError("Session is stale. Please sign in again.", 401);
    }
    return jsonError("Unauthorized", 401);
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return jsonError("Missing file", 400);
  }

  if (!allowedTypes.has(file.type)) {
    return jsonError("Unsupported file type", 400);
  }
  if (file.size <= 0 || file.size > maxSizeBytes) {
    return jsonError("Invalid file size", 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const key = buildObjectKey();
  try {
    await putObject({
      key,
      body: buffer,
      contentType: file.type,
    });

    return jsonCreated({
      key,
      publicUrl: getPublicObjectUrl(key),
      storage: "s3",
    });
  } catch {
    if (!env.ALLOW_LOCAL_UPLOAD_FALLBACK) {
      return jsonError("Upload storage unavailable. MinIO/S3 upload failed.", 502);
    }

    const local = await saveToLocalDisk(file.type, buffer);
    return jsonCreated(local);
  }
}
