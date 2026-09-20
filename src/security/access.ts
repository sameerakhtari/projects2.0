import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import type { Bindings } from "../types";
const resolvers = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
export class AccessDenied extends Error {}

export async function verifyAccess(
  request: Request,
  env: Bindings,
  testKey?: JWTVerifyGetKey,
): Promise<string> {
  const issuer = env.ACCESS_ISSUER;
  const audience = env.ACCESS_AUDIENCE;
  const subjects = (env.ACCESS_OWNER_SUBJECTS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (
    !issuer ||
    !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer) ||
    !audience ||
    subjects.length === 0
  )
    throw new AccessDenied();
  const assertion = request.headers.get("cf-access-jwt-assertion");
  if (!assertion || assertion.length > 16384) throw new AccessDenied();
  let resolver = testKey ?? resolvers.get(issuer);
  if (!resolver) {
    resolver = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`), {
      timeoutDuration: 5000,
      cooldownDuration: 30000,
      cacheMaxAge: 600000,
    });
    // Only configured issuers become keys; request headers never select a JWKS URL.
    if (resolvers.size >= 4) resolvers.clear();
    resolvers.set(issuer, resolver as ReturnType<typeof createRemoteJWKSet>);
  }
  try {
    const { payload } = await jwtVerify(assertion, resolver, {
      issuer,
      audience,
      algorithms: ["RS256"],
      requiredClaims: ["exp", "iat", "sub", "aud", "iss", "type"],
      clockTolerance: 0,
    });
    if (
      payload.type !== "app" ||
      typeof payload.sub !== "string" ||
      !subjects.includes(payload.sub) ||
      typeof payload.iat !== "number" ||
      payload.iat > Date.now() / 1000 + 5
    )
      throw new AccessDenied();
    return payload.sub;
  } catch {
    throw new AccessDenied();
  }
}

export async function auditActor(subject: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(subject),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 24);
}
