import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
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

/**
 * During `next build` (Vercel) the env vars are not yet provisioned, so we
 * must not throw at module scope — only fail fast at runtime (dev/start).
 */
const isBuildPhase =
  process.env.NEXT_PHASE === "phase-production-build" ||
  process.env.NEXT_PHASE === "phase-development-build";

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  if (isBuildPhase) {
    console.warn(
      "⚠ Env vars not set during build — using placeholders (runtime will fail fast if unset)."
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

export const env = parsed.success
  ? parsed.data
  : envSchema.parse({ ...buildFallback, ...process.env });