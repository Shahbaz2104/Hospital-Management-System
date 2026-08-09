import { createHash } from "crypto";
import { z } from "zod";

import { secretSeed } from "@/lib/auth/secrets";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL (or MONGODB_URI) is required"),
  JWT_ACCESS_SECRET: z.string().min(16).optional(),
  JWT_REFRESH_SECRET: z.string().min(16).optional(),
  JWT_ACCESS_EXPIRES_IN: z.coerce.number().default(900),
  JWT_REFRESH_EXPIRES_IN: z.coerce.number().default(604800),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default("Hospital Management <no-reply@hospital.local>"),
  SEED_ADMIN_PASSWORD: z.string().default("Admin@1234"),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
});

// Accept MONGODB_URI as an alias for DATABASE_URL (common on Vercel).
if (!process.env.DATABASE_URL && process.env.MONGODB_URI) {
  process.env.DATABASE_URL = process.env.MONGODB_URI;
}

// Prisma (MongoDB) requires a database name in the connection string.
// Normalize e.g. "mongodb.net/?retryWrites=..." → "...mongodb.net/hospital_management?retryWrites=..."
// Also handles edge cases: trailing slash, or an existing path with no slash
// separation (never double-append the database name).
const rawUrl = process.env.DATABASE_URL;
if (rawUrl) {
  const [base, query] = rawUrl.split("?");
  const trimmed = base.replace(/\/+$/, "");
  const hasDbName = /mongodb(\+srv)?:\/\/.*\/[^/?]+/.test(trimmed);
  if (!hasDbName) {
    process.env.DATABASE_URL = `${trimmed}/hospital_management${query ? `?${query}` : ""}`;
  }
}

/**
 * During `next build` (Vercel) the env vars are not yet provisioned, so we
 * must not throw at module scope — only fail fast at runtime (dev/start).
 */
const isBuildPhase =
  process.env.NEXT_PHASE === "phase-production-build" ||
  process.env.NEXT_PHASE === "phase-development-build";

// Derive stable JWT secrets from the DB connection string when they are not
// provided. Deterministic, so issued sessions remain valid across serverless
// cold starts and redeploys. Explicit secrets always take precedence.
function derivedSecret(salt: string): string {
  return createHash("sha256")
    .update(secretSeed(salt))
    .digest("base64")
    .replace(/[^a-zA-Z0-9]/g, "");
}

if (!process.env.JWT_ACCESS_SECRET || process.env.JWT_ACCESS_SECRET.length < 16) {
  process.env.JWT_ACCESS_SECRET = derivedSecret("access");
}
if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET.length < 16) {
  process.env.JWT_REFRESH_SECRET = derivedSecret("refresh");
}

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  if (isBuildPhase) {
    console.warn(
      "⚠ Env vars not fully set during build — using placeholders (runtime will handle real env)."
    );
  } else if (!process.env.DATABASE_URL) {
    console.error(
      "❌ Missing DATABASE_URL (or MONGODB_URI). Hint: in Vercel → Settings → Environment Variables, " +
        "set MONGODB_URI to your MongoDB Atlas connection string, then Redeploy."
    );
    throw new Error(
      "Missing DATABASE_URL/MONGODB_URI — add it in Vercel settings and redeploy."
    );
  } else {
    console.error(
      "❌ Invalid environment variables:",
      parsed.error.flatten().fieldErrors
    );
    throw new Error("Invalid environment variables — check .env / .env.example");
  }
}

const buildFallback = {
  DATABASE_URL: "mongodb://localhost:27017/build-placeholder",
  JWT_ACCESS_SECRET: "build-placeholder-access-secret",
  JWT_REFRESH_SECRET: "build-placeholder-refresh-secret",
};

let envData: z.infer<typeof envSchema>;

if (parsed.success) {
  envData = parsed.data;
} else if (isBuildPhase) {
  envData = envSchema.parse({ ...buildFallback, ...process.env });
} else {
  envData = envSchema.parse(process.env);
}

export const env = envData;