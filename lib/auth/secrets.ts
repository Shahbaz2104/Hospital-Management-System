/**
 * Single source of truth for JWT secrets.
 *
 * Explicit env vars (JWT_ACCESS_SECRET / JWT_REFRESH_SECRET) are REQUIRED.
 * Derivation from DATABASE_URL is disabled — it was a security risk because
 * anyone with the connection string could forge tokens.
 *
 * Edge-safe (Web Crypto only) so it can be used from `middleware.ts`.
 */

function isExplicit(value: string | undefined): value is string {
  return typeof value === "string" && value.length >= 16;
}

let cached: { access: string; refresh: string } | null = null;

export async function resolveJwtSecrets(): Promise<{
  access: string;
  refresh: string;
}> {
  if (cached) return cached;

  const access = process.env.JWT_ACCESS_SECRET;
  const refresh = process.env.JWT_REFRESH_SECRET;

  if (!isExplicit(access) || !isExplicit(refresh)) {
    throw new Error(
      "JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set to high-entropy strings (≥16 chars). " +
      "Generate them with: node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\""
    );
  }

  cached = { access, refresh };
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
