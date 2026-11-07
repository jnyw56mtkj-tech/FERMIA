import { canManageFarmData, errorResponse, isMemberContext, requireMember, type PagesContext } from "../_lib/auth";

export async function onRequestPatch({ request, env, params }: PagesContext): Promise<Response> {
  const member = await requireMember(request, env);
  if (!isMemberContext(member)) return member;
  if (!canManageFarmData(member.role)) return errorResponse("Only owner, admin, or manager can edit harvest records.", 403);
  const id = params?.id?.trim();
  if (!id || id.length > 128) return errorResponse("Invalid record ID.", 400);
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return errorResponse("Request body must be valid JSON.", 400); }
  const fieldId = typeof body.field_id === "string" ? body.field_id.trim() : "";
  const cropCycleId = typeof body.crop_cycle_id === "string" && body.crop_cycle_id.trim() ? body.crop_cycle_id.trim() : null;
  const harvestedOn = typeof body.harvested_on === "string" ? body.harvested_on.trim() : "";
  const quantity = Number(body.quantity);
  const unit = typeof body.unit === "string" ? body.unit.trim() : "";
  const quality = typeof body.quality_grade === "string" ? body.quality_grade.trim() : "";
  const destination = typeof body.destination === "string" ? body.destination.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  if (!fieldId || fieldId.length > 128 || !/^\d{4}-\d{2}-\d{2}$/.test(harvestedOn) ||
      !Number.isFinite(quantity) || quantity <= 0 || quantity > 100000000 ||
      !unit || unit.length > 20 || quality.length > 80 || destination.length > 160 || notes.length > 2000) {
    return errorResponse("Enter a field, valid harvest date, positive quantity, unit, and valid optional details.", 400);
  }
  try {
    const existing = await env.DB!.prepare("SELECT id FROM harvest_records WHERE id = ? AND organization_id = ?")
      .bind(id, member.organizationId).first();
    if (!existing) return errorResponse("Record not found.", 404);
    const field = await env.DB!.prepare("SELECT id FROM fields WHERE id = ? AND organization_id = ?")
      .bind(fieldId, member.organizationId).first();
    if (!field) return errorResponse("Selected field was not found in this organization.", 400);
    if (cropCycleId) {
      const crop = await env.DB!.prepare("SELECT id FROM crop_cycles WHERE id = ? AND field_id = ? AND organization_id = ?")
        .bind(cropCycleId, fieldId, member.organizationId).first();
      if (!crop) return errorResponse("Selected crop cycle does not belong to the selected field.", 400);
    }
    await env.DB!.prepare(
      `UPDATE harvest_records SET field_id = ?, crop_cycle_id = ?, harvested_on = ?, quantity = ?, unit = ?, quality_grade = ?, destination = ?, notes = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ? AND organization_id = ?`
    ).bind(fieldId, cropCycleId, harvestedOn, quantity, unit, quality || null, destination || null, notes || null, id, member.organizationId).run();
    await env.DB!.prepare(
      `INSERT INTO audit_events (id, organization_id, actor_user_id, action, resource_type, resource_id)
       VALUES (?, ?, ?, 'update', 'harvest_record', ?)`
    ).bind(crypto.randomUUID(), member.organizationId, member.userId, id).run();
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return errorResponse("Could not update harvest record.", 400);
  }
}

export async function onRequestDelete({ request, env, params }: PagesContext): Promise<Response> {
  const member = await requireMember(request, env);
  if (!isMemberContext(member)) return member;
  if (!["owner", "admin"].includes(member.role)) return errorResponse("Only owner or admin can delete harvest records.", 403);
  const id = params?.id?.trim();
  if (!id || id.length > 128) return errorResponse("Invalid record ID.", 400);
  try {
    const existing = await env.DB!.prepare("SELECT id FROM harvest_records WHERE id = ? AND organization_id = ?")
      .bind(id, member.organizationId).first();
    if (!existing) return errorResponse("Record not found.", 404);
    await env.DB!.prepare("DELETE FROM harvest_records WHERE id = ? AND organization_id = ?")
      .bind(id, member.organizationId).run();
    await env.DB!.prepare(
      `INSERT INTO audit_events (id, organization_id, actor_user_id, action, resource_type, resource_id)
       VALUES (?, ?, ?, 'delete', 'harvest_record', ?)`
    ).bind(crypto.randomUUID(), member.organizationId, member.userId, id).run();
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch {
    return errorResponse("Could not delete harvest record.", 409);
  }
}
