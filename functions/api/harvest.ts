import { canManageFarmData, errorResponse, isMemberContext, requireMember, type PagesContext } from "./_lib/auth";

export async function onRequestGet({ request, env }: PagesContext): Promise<Response> {
  const member = await requireMember(request, env);
  if (!isMemberContext(member)) return member;
  try {
    const result = await env.DB!.prepare(
      `SELECT h.*, f.name AS field_name, fa.name AS farm_name, c.crop_name, c.variety
       FROM harvest_records h
       INNER JOIN fields f ON f.id = h.field_id AND f.organization_id = h.organization_id
       INNER JOIN farms fa ON fa.id = f.farm_id AND fa.organization_id = f.organization_id
       LEFT JOIN crop_cycles c ON c.id = h.crop_cycle_id AND c.organization_id = h.organization_id
       WHERE h.organization_id = ?
       ORDER BY h.harvested_on DESC, h.created_at DESC LIMIT 1000`
    ).bind(member.organizationId).all();
    return Response.json({ items: result.results }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return errorResponse("Could not load harvest records. Apply migration 0002 first.", 500);
  }
}

export async function onRequestPost({ request, env }: PagesContext): Promise<Response> {
  const member = await requireMember(request, env);
  if (!isMemberContext(member)) return member;
  if (!canManageFarmData(member.role)) return errorResponse("Only owner, admin, or manager can create harvest records.", 403);
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
    const field = await env.DB!.prepare(
      "SELECT id FROM fields WHERE id = ? AND organization_id = ?"
    ).bind(fieldId, member.organizationId).first();
    if (!field) return errorResponse("Selected field was not found in this organization.", 400);
    if (cropCycleId) {
      const crop = await env.DB!.prepare(
        "SELECT id FROM crop_cycles WHERE id = ? AND field_id = ? AND organization_id = ?"
      ).bind(cropCycleId, fieldId, member.organizationId).first();
      if (!crop) return errorResponse("Selected crop cycle does not belong to the selected field.", 400);
    }
    const id = crypto.randomUUID();
    await env.DB!.prepare(
      `INSERT INTO harvest_records (id, organization_id, field_id, crop_cycle_id, harvested_on, quantity, unit, quality_grade, destination, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, member.organizationId, fieldId, cropCycleId, harvestedOn, quantity, unit, quality || null, destination || null, notes || null, member.userId).run();
    await env.DB!.prepare(
      `INSERT INTO audit_events (id, organization_id, actor_user_id, action, resource_type, resource_id)
       VALUES (?, ?, ?, 'create', 'harvest_record', ?)`
    ).bind(crypto.randomUUID(), member.organizationId, member.userId, id).run();
    return Response.json({ item: { id, field_id: fieldId, crop_cycle_id: cropCycleId, harvested_on: harvestedOn, quantity, unit, quality_grade: quality || null, destination: destination || null, notes: notes || null } }, {
      status: 201, headers: { "Cache-Control": "no-store" }
    });
  } catch {
    return errorResponse("Could not save harvest record.", 400);
  }
}
