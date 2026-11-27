import { createHmac } from "node:crypto";

/**
 * Short-lived token for the realtime server (HMAC-SHA256 with WORLD_RT_SECRET, shared with realtime/.env).
 * Server-only. The realtime server only checks the signature — it never touches the database.
 */
export function signRealtimeToken(p: { uid: string; name: string; demo: boolean }, ttlMs = 10 * 60 * 1000): string | null {
  const secret = process.env.WORLD_RT_SECRET;
  if (!secret) return null;
  const body = Buffer.from(JSON.stringify({ ...p, exp: Date.now() + ttlMs })).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export const realtimeUrl = () => process.env.WORLD_RT_URL || null;
