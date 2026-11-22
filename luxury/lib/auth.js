import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

const KEY_LENGTH = 64;

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, storedValue) {
  const [salt, storedHash] = String(storedValue || "").split(":");
  if (!salt || !storedHash) return false;

  const actual = scryptSync(password, salt, KEY_LENGTH);
  const expected = Buffer.from(storedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function parseCookies(header = "") {
  const cookies = {};
  for (const part of String(header || "").split(";")) {
    const index = part.indexOf("=");
    if (index < 1) continue;
    try { cookies[decodeURIComponent(part.slice(0, index).trim())] = decodeURIComponent(part.slice(index + 1)); }
    catch { /* An unrelated malformed cookie cannot invalidate a valid session. */ }
  }
  return cookies;
}

export function sessionCookie(token, options = {}) {
  const secure = options.secure ? "; Secure" : "";
  const maxAge = Math.max(0, Number(options.maxAge || 0));
  const name = /^[A-Za-z0-9_-]+$/.test(String(options.name || ""))
    ? String(options.name)
    : "lt_session";
  return `${name}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}
