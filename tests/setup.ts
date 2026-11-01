/**
 * Vitest global setup.
 *
 * Must run BEFORE any module that imports `@/lib/env`, because that module
 * parses `process.env` at import time and throws on missing/short values.
 * Test credentials here are throwaway and never touch a real database.
 */
process.env.NODE_ENV ??= "test";

// `lib/env` refuses to boot without these. Placeholders are fine: they are only
// used to sign test tokens inside an in-memory replica set.
process.env.DATABASE_URL ??= "mongodb://127.0.0.1:27017/hms_test";
process.env.JWT_ACCESS_SECRET ??= "test-access-secret-at-least-16-chars";
process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret-at-least-16-chars";
process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";

// Keep SMTP / Cloudinary / Stripe out of the picture so tests never attempt
// real network calls. Services are expected to degrade gracefully when unset.
for (const key of [
  "SMTP_HOST",
  "SMTP_USER",
  "SMTP_PASS",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
]) {
  delete process.env[key];
}

// Deterministic seed password for integration fixtures.
process.env.SEED_ADMIN_PASSWORD = "Test@12345";