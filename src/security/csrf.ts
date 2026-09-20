import { SignJWT, jwtVerify } from "jose";
import type { Bindings } from "../types";
import { AccessDenied } from "./access";
function secret(env: Bindings) {
  if (
    !env.CSRF_SECRET ||
    env.CSRF_SECRET.length < 32 ||
    env.CSRF_SECRET.startsWith("GENERATE-")
  )
    throw new AccessDenied();
  return new TextEncoder().encode(env.CSRF_SECRET);
}
export function trustedOrigin(env: Bindings): string {
  if (!env.SITE_ORIGIN) throw new AccessDenied();
  const url = new URL(env.SITE_ORIGIN);
  if (
    url.origin !== env.SITE_ORIGIN ||
    url.username ||
    url.password ||
    (url.protocol !== "https:" && env.ENVIRONMENT !== "development")
  )
    throw new AccessDenied();
  return url.origin;
}
export async function createCsrf(
  subject: string,
  env: Bindings,
): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(subject)
    .setAudience("atlas-admin-csrf")
    .setIssuer(trustedOrigin(env))
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(secret(env));
}
export async function requireCsrf(
  req: Request,
  subject: string,
  env: Bindings,
): Promise<void> {
  if (
    !["POST", "PUT", "PATCH", "DELETE"].includes(req.method) ||
    req.headers.get("origin") !== trustedOrigin(env)
  )
    throw new AccessDenied();
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none")
    throw new AccessDenied();
  const token = req.headers.get("x-csrf-token");
  if (!token || token.length > 2048) throw new AccessDenied();
  try {
    const { payload } = await jwtVerify(token, secret(env), {
      algorithms: ["HS256"],
      issuer: trustedOrigin(env),
      audience: "atlas-admin-csrf",
      subject,
      requiredClaims: ["exp", "iat", "sub", "jti"],
    });
    if (!payload.jti) throw new AccessDenied();
  } catch {
    throw new AccessDenied();
  }
}
