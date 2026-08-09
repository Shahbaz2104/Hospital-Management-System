/**
 * Single source of truth for JWT secrets.
 *
 * Explicit env vars (JWT_ACCESS_SECRET / JWT_REFRESH_SECRET) take precedence;
 * otherwise a stable secret is derived from the DB connection string so
 * sessions survive serverless cold starts and redeploys.
 *
 * Edge-safe (Web Crypto only) so it can be used from `middleware.ts`.
 * `lib/env.ts` reuses `secretSeed()` with node crypto and produces the
 * identical value — keep the two in sync.
 */

const DERIVE_SALT = "hms-secret";

export function secretSeed(salt: string): string {
  return `${salt}:${process.env.DATABASE_URL ?? ""}:${DERIVE_SALT}`;
}

async function sha256Base64(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/[^a-zA-Z0-9]/g, "");
}

export async function deriveJwtSecret(salt: string): Promise<string> {
  return sha256Base64(secretSeed(salt));
}

function isExplicit(value: string | undefined): value is string {
  return typeof value === "string" && value.length >= 16;
}

let cached: { access: string; refresh: string } | null = null;

export async function resolveJwtSecrets(): Promise<{
  access: string;
  refresh: string;
}> {
  if (cached) return cached;
  cached = {
    access: isExplicit(process.env.JWT_ACCESS_SECRET)
      ? process.env.JWT_ACCESS_SECRET
      : await deriveJwtSecret("access"),
    refresh: isExplicit(process.env.JWT_REFRESH_SECRET)
      ? process.env.JWT_REFRESH_SECRET
      : await deriveJwtSecret("refresh"),
  };
  return cached;
}

/**
 * Short HMAC-SHA256 signature (32 chars, URL/base64-safe) for content that
 * must be verifiable without a session (e.g. prescription QR payloads).
 * Keys off the access secret so signatures survive cold starts/redeploys.
 */
export async function signHmac(input: string): Promise<string> {
  const { access } = await resolveJwtSecrets();
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(access),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input));
  const bytes = new Uint8Array(digest);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/[^a-zA-Z0-9]/g, "").slice(0, 32);
}
