import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { getEnv } from "./env";

const COOKIE_NAME = "admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours

// -----------------------------------------------------------------------
// NOTE: This is a minimal password + signed-cookie auth provider so the
// admin panel works out of the box. It is intentionally isolated behind
// the functions below (verifyAdminCredentials / createAdminSession /
// getAdminSession / destroyAdminSession) so it can be swapped for a real
// Auth.js (NextAuth) provider later without touching the page components.
// -----------------------------------------------------------------------

interface SessionPayload {
  sub: string; // admin username
  exp: number; // epoch ms
}

function sign(payload: string): string {
  const env = getEnv();
  const secret = env.ADMIN_SESSION_SECRET || env.CRON_SECRET;
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function encode(payload: SessionPayload): string {
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json).toString("base64url");
  const sig = sign(b64);
  return `${b64}.${sig}`;
}

function decode(token: string): SessionPayload | null {
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return null;
  const expectedSig = sign(b64);
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(b64, "base64url").toString()) as SessionPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function verifyAdminCredentials(username: string, password: string): boolean {
  const env = getEnv();
  if (!env.ADMIN_PANEL_PASSWORD) return false;
  const userOk =
    username.length === env.ADMIN_PANEL_USERNAME.length &&
    timingSafeEqual(Buffer.from(username), Buffer.from(env.ADMIN_PANEL_USERNAME));
  const passOk =
    password.length === env.ADMIN_PANEL_PASSWORD.length &&
    timingSafeEqual(Buffer.from(password), Buffer.from(env.ADMIN_PANEL_PASSWORD));
  return userOk && passOk;
}

export async function createAdminSession(username: string): Promise<void> {
  const token = encode({ sub: username, exp: Date.now() + SESSION_TTL_MS });
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function getAdminSession(): Promise<{ username: string } | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = decode(token);
  return payload ? { username: payload.sub } : null;
}

export async function destroyAdminSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
