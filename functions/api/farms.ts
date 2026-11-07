import {
  canManageFarmData,
  errorResponse,
  isMemberContext,
  requireMember,
  type PagesContext
} from "./_lib/auth";

export async function onRequestGet({ request, env }: PagesContext): Promise<Response> {
  const member = await requireMember(request, env);
  if (!isMemberContext(member)) return member;

  try {
    const result = await env.DB!.prepare(
      `SELECT id, name, location, area_hectares AS areaHectares, notes,
              created_at AS createdAt, updated_at AS updatedAt
       FROM farms
       WHERE organization_id = ?
       ORDER BY name COLLATE NOCASE`
    ).bind(member.organizationId).all();
    return Response.json({ farms: result.results }, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch {
    return errorResponse("Could not load farms.", 500);
  }
}

export async function onRequestPost({ request, env }: PagesContext): Promise<Response> {
  const member = await requireMember(request, env);
  if (!isMemberContext(member)) return member;
  if (!canManageFarmData(member.role)) {
    return errorResponse("Your role cannot create farms.", 403);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return errorResponse("Request body must be valid JSON.", 400);
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const location = typeof body.location === "string" ? body.location.trim() : null;
  const notes = typeof body.notes === "string" ? body.notes.trim() : null;
  const area = body.areaHectares === undefined || body.areaHectares === null || body.areaHectares === ""
    ? null
    : Number(body.areaHectares);

  if (!name || name.length > 120) return errorResponse("Farm name is required (up to 120 characters).", 400);
  if (area !== null && (!Number.isFinite(area) || area < 0 || area > 1_000_000)) {
    return errorResponse("Area must be a valid non-negative number.", 400);
  }

  const id = crypto.randomUUID();
  try {
    await env.DB!.prepare(
      `INSERT INTO farms (id, organization_id, name, location, area_hectares, notes)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(id, member.organizationId, name, location, area, notes).run();

    await env.DB!.prepare(
      `INSERT INTO audit_events
       (id, organization_id, actor_user_id, action, resource_type, resource_id)
       VALUES (?, ?, ?, 'create', 'farm', ?)`
    ).bind(crypto.randomUUID(), member.organizationId, member.userId, id).run();

    return Response.json({ farm: { id, name, location, areaHectares: area, notes } }, {
      status: 201,
      headers: { "Cache-Control": "no-store" }
    });
  } catch {
    return errorResponse("Could not create farm. Check that the database migration has been applied.", 500);
  }
}
