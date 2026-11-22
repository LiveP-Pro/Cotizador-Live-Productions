"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { createLiveUserStore, hasPermission } = require("../../live-users.cjs");

const key = (value) => String(value || "").normalize("NFC").trim().toLocaleLowerCase("en-US");

function createLiveAuthBridge({ directory = "" } = {}) {
  const enabled = Boolean(directory);
  const snapshot = () => {
    if (!enabled) return null;
    try {
      const legacyAdmin = JSON.parse(fs.readFileSync(path.join(directory, "cotizador-auth.json"), "utf8"));
      if (typeof legacyAdmin.sessionSecret !== "string" || !legacyAdmin.sessionSecret) return null;
      return { legacyAdmin, store: createLiveUserStore({ directory, legacyAdmin, readOnly: true }) };
    } catch { return null; }
  };
  const liveUser = (user) => user && ({
    id: `live:${user.id}`, liveUserId: user.id, username: user.username, name: user.displayName || user.username,
    email: user.username, role: "administrador", active: true, authProvider: "live-productions"
  });
  const matchIdentity = (store, identifier, nativeUser) => {
    const identities = [identifier, nativeUser?.username, nativeUser?.email, nativeUser?.name].map(key).filter(Boolean);
    const matches = store.list().filter((user) => identities.includes(key(user.username))
      || nativeUser?.name && key(nativeUser.name) === key(user.displayName));
    return matches.length === 1 ? matches[0] : matches.length > 1 ? { ambiguous: true } : null;
  };
  const authenticate = (identifier, password, nativeUser = null) => {
    if (!enabled) return { matched: false, user: null };
    const current = snapshot();
    if (!current) return { matched: true, unavailable: true, user: null };
    const candidate = matchIdentity(current.store, identifier, nativeUser);
    if (!candidate) return { matched: false, user: null };
    if (candidate.ambiguous) return { matched: true, forbidden: true, user: null };
    const user = current.store.authenticate(candidate.username, password);
    if (!user) return { matched: true, user: null };
    if (!hasPermission(user, "luxury.access")) return { matched: true, forbidden: true, user: null };
    return { matched: true, user: liveUser(user), liveSession: { ...current.store.sessionFor(user),
      authFingerprint: crypto.createHash("sha256").update(current.legacyAdmin.sessionSecret).digest("hex") } };
  };
  const resolveRootCookie = (token) => {
    if (!enabled || !token) return { present: false, user: null };
    const current = snapshot();
    if (!current) return { present: true, unavailable: true, user: null };
    try {
      const parts = String(token).split(".");
      if (parts.length !== 2) return { present: true, user: null };
      const [body, signature] = parts;
      const expected = crypto.createHmac("sha256", current.legacyAdmin.sessionSecret).update(body).digest("base64url");
      const actualBuffer = Buffer.from(signature), expectedBuffer = Buffer.from(expected);
      if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) return { present: true, user: null };
      const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
      const user = current.store.resolveSession(payload);
      if (!user) {
        const known = current.store.getUser(payload.userId || payload.user);
        const revoked = known && (!known.active || !hasPermission(known, "luxury.access")
          || (payload.userId ? payload.sessionVersion !== known.sessionVersion : known.sessionVersion !== 1));
        return { present: true, ...(revoked ? { forbidden: true } : {}), user: null };
      }
      if (!hasPermission(user, "luxury.access")) return { present: true, forbidden: true, user: null };
      return { present: true, user: liveUser(user) };
    } catch { return { present: true, user: null }; }
  };
  const resolveFederatedSession = (session) => {
    if (!enabled || !session) return null;
    const current = snapshot();
    if (!current) return null;
    if (session.authFingerprint !== crypto.createHash("sha256").update(current.legacyAdmin.sessionSecret).digest("hex")) return null;
    const user = current.store.resolveSession(session);
    return hasPermission(user, "luxury.access") ? liveUser(user) : null;
  };
  const allowNativeSession = (nativeUser) => {
    if (!enabled) return true;
    const current = snapshot();
    // A root-managed employee must sign in through the root identity. Native
    // cookies cannot bypass a disabled account, a reset password or new access.
    return Boolean(current && !matchIdentity(current.store, "", nativeUser));
  };
  const resolveActor = (id) => {
    if (!enabled || !String(id).startsWith("live:")) return null;
    const current = snapshot();
    const user = current?.store.getUser(String(id).slice(5));
    return hasPermission(user, "luxury.access") ? liveUser(user) : null;
  };
  return { enabled, authenticate, resolveRootCookie, resolveFederatedSession, allowNativeSession, resolveActor };
}

module.exports = { createLiveAuthBridge };
