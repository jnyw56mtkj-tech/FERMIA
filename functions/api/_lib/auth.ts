import { createRemoteJWKSet, jwtVerify } from "jose";

export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}
export interface D1Database {
  prepare(query: string): D1Statement;
}
export interface Env {
  DB?: D1Database;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
}
export interface MemberContext {
  organizationId: string;
  userId: string;
  email: string;
  role: "owner" | "admin" | "manager" | "staff" | "viewer";
}
export interface PagesContext {
  request: Request;
  env: Env;
  params?: Record<string, string>;
}

let cachedJwks: ReturnType<typeof createRemoteJWKSet> | undefined;
let cachedIssuer = "";

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

export async function requireMember(
  request: Request,
  env: Env
): Promise<MemberContext | Response> {
  if (!env.DB) return jsonError("Database is not configured.", 503);
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) {
    return jsonError("Authentication is not configured.", 503);
  }

  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) return jsonError("Sign-in required.", 401);

  let email = "";
  try {
    const issuer = env.ACCESS_TEAM_DOMAIN.replace(/\/$/, "");
    if (cachedIssuer !== issuer || !cachedJwks) {
      cachedJwks = createRemoteJWKSet(
        new URL(`${issuer}/cdn-cgi/access/certs`)
      );
      cachedIssuer = issuer;
    }
    const verified = await jwtVerify(token, cachedJwks, {
      issuer,
      audience: env.ACCESS_AUD
    });
    const claim = verified.payload.email;
    if (typeof claim !== "string" || !claim.includes("@")) {
      return jsonError("Verified identity has no usable email claim.", 403);
    }
    email = claim.trim().toLowerCase();
  } catch {
    return jsonError("Invalid or expired sign-in token.", 401);
  }

  const organizationId = new URL(request.url).searchParams.get("organization_id")?.trim();
  if (!organizationId || organizationId.length > 128) {
    return jsonError("organization_id is required.", 400);
  }

  const member = await env.DB.prepare(
    `SELECT u.id AS userId, u.email AS email, m.role AS role
     FROM memberships m
     INNER JOIN users u ON u.id = m.user_id
     WHERE m.organization_id = ? AND lower(u.email) = ?
     LIMIT 1`
  ).bind(organizationId, email).first<{
    userId: string;
    email: string;
    role: MemberContext["role"];
  }>();

  if (!member) return jsonError("You do not have access to this organization.", 403);

  return {
    organizationId,
    userId: member.userId,
    email: member.email,
    role: member.role
  };
}

export function isMemberContext(value: MemberContext | Response): value is MemberContext {
  return !(value instanceof Response);
}

export function canManageFarmData(role: MemberContext["role"]): boolean {
  return role === "owner" || role === "admin" || role === "manager";
}

export function errorResponse(message: string, status: number): Response {
  return jsonError(message, status);
}
