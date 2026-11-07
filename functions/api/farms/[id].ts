import {
  canManageFarmData,
  errorResponse,
  isMemberContext,
  requireMember,
  type PagesContext
} from "../_lib/auth";

export async function onRequestPatch({ request, env, params }: PagesContext): Promise<Response> {
  const member = await requireMember(request, env);
  if (!isMemberContext(member)) return member;
  if (!canManageFarmData(member.role)) return errorResponse("Your role cannot edit farms.", 403);

  const id = params?.id?.trim();
  if (!id || id.length > 128) return errorResponse("Invalid farm ID.", 400);

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

  try {
    const result = await env.DB!.prepare(
      `UPDATE farms
       SET name = ?, location = ?, area_hectares = ?, notes = ?,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ? AND organization_id = ?`
    ).bind(name, location, area, notes, id, member.organizationId).run();

    const changed = (result as { meta?: { changes?: number } }).meta?.changes ?? 0;
    if (!changed) return errorResponse("Farm not found.", 404);

    await env.DB!.prepare(
      `INSERT INTO audit_events
       (id, organization_id, actor_user_id, action, resource_type, resource_id)
       VALUES (?, ?, ?, 'update', 'farm', ?)`
    ).bind(crypto.randomUUID(), member.organizationId, member.userId, id).run();

    return Response.json({ farm: { id, name, location, areaHectares: area, notes } }, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch {
    return errorResponse("Could not update farm.", 500);
  }
}

export async function onRequestDelete({ request, env, params }: PagesContext): Promise<Response> {
  const member = await requireMember(request, env);
  if (!isMemberContext(member)) return member;
  if (member.role !== "owner" && member.role !== "admin") {
    return errorResponse("Only an owner or admin can delete farms.", 403);
  }

  const id = params?.id?.trim();
  if (!id || id.length > 128) return errorResponse("Invalid farm ID.", 400);

  try {
    const result = await env.DB!.prepare(
      "DELETE FROM farms WHERE id = ? AND organization_id = ?"
    ).bind(id, member.organizationId).run();

    const changed = (result as { meta?: { changes?: number } }).meta?.changes ?? 0;
    if (!changed) return errorResponse("Farm not found.", 404);

    await env.DB!.prepare(
      `INSERT INTO audit_events
       (id, organization_id, actor_user_id, action, resource_type, resource_id)
       VALUES (?, ?, ?, 'delete', 'farm', ?)`
    ).bind(crypto.randomUUID(), member.organizationId, member.userId, id).run();

    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch {
    return errorResponse("Could not delete farm. Remove dependent records first if required.", 409);
  }
}
