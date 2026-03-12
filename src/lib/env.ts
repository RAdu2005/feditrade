import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  AUTH_TRUST_HOST: z
    .enum(["true", "false"])
    .optional()
    .default("false"),
  APP_BASE_URL: z.string().url(),
  AP_INSTANCE_DOMAIN: z.string().min(1),
  AP_LISTINGS_ACTOR: z.string().min(1),
  AP_PRIVATE_KEY_PEM: z.string().min(1),
  AP_PUBLIC_KEY_PEM: z.string().min(1),
  AP_FEDERATION_TARGETS: z.string().optional().default(""),
  AP_ENABLE_LEGACY_NOTES: z.enum(["true", "false"]).optional().default("true"),
  AP_ENABLE_FEP_MARKETPLACE: z.enum(["true", "false"]).optional().default("false"),
  AP_FEP_CAPABLE_INSTANCES: z.string().optional().default(""),
  AP_MARKETPLACE_ACTOR_MODE: z.enum(["shared", "per-user"]).optional().default("shared"),
  ADMIN_ACTOR_URIS: z.string().optional().default(""),
  S3_REGION: z.string().default("us-east-1"),
  S3_ENDPOINT: z.string().url(),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_PUBLIC_BASE_URL: z.string().url(),
  ALLOW_LOCAL_UPLOAD_FALLBACK: z
    .enum(["true", "false"])
    .optional()
    .default("false"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeDomainLikeEntry(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed).hostname.toLowerCase();
  } catch {
    return trimmed
      .replace(/^https?:\/\//i, "")
      .split("/")[0]
      ?.toLowerCase() ?? null;
  }
}

export const env = {
  ...parsed.data,
  AP_FEDERATION_TARGETS: splitCsv(parsed.data.AP_FEDERATION_TARGETS),
  AP_FEP_CAPABLE_INSTANCES: splitCsv(parsed.data.AP_FEP_CAPABLE_INSTANCES)
    .map(normalizeDomainLikeEntry)
    .filter((value): value is string => Boolean(value)),
  AP_ENABLE_LEGACY_NOTES: parsed.data.AP_ENABLE_LEGACY_NOTES === "true",
  AP_ENABLE_FEP_MARKETPLACE: parsed.data.AP_ENABLE_FEP_MARKETPLACE === "true",
  ADMIN_ACTOR_URIS: splitCsv(parsed.data.ADMIN_ACTOR_URIS),
  AUTH_TRUST_HOST: parsed.data.AUTH_TRUST_HOST === "true",
  ALLOW_LOCAL_UPLOAD_FALLBACK: parsed.data.ALLOW_LOCAL_UPLOAD_FALLBACK === "true",
};

export type Env = typeof env;
