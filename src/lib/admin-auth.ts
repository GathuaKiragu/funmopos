import "server-only";
import crypto from "crypto";
import { cookies } from "next/headers";

const COOKIE = "admin_session";
const MAX_AGE_SECONDS = 60 * 60 * 8;

function secret() {
  const value = process.env.ADMIN_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("ADMIN_SESSION_SECRET must be configured (32+ characters)");
  return value;
}

function sign(payload: string) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createAdminSession() {
  const payload = Buffer.from(JSON.stringify({ role: "admin", exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyAdminSession(token?: string) {
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expected = sign(payload);
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return parsed.role === "admin" && Number.isInteger(parsed.exp) && parsed.exp > Math.floor(Date.now() / 1000);
  } catch { return false; }
}

export async function requireAdmin() {
  return verifyAdminSession((await cookies()).get(COOKIE)?.value);
}

export const adminCookieName = COOKIE;
export const adminSessionMaxAge = MAX_AGE_SECONDS;
