import {
  canManageFarmData,
  errorResponse,
  isMemberContext,
  requireMember,
  type PagesContext
} from "../../_lib/auth";

type Resource = "fields" | "crops" | "tasks" | "inventory";
const resources: Record<Resource, { table: string; columns: string[]; managerOnly: boolean }> = {
  fields: { table: "fields", columns: ["farm_id", "name", "area_hectares", "soil_type", "water_source", "notes"], managerOnly: true },
  crops: { table: "crop_cycles", columns: ["field_id", "crop_name", "variety", "season", "status", "planting_date", "expected_harvest_date", "actual_harvest_date", "notes"], managerOnly: true },
  tasks: { table: "work_tasks", columns: ["farm_id", "field_id", "crop_cycle_id", "title", "description", "category", "scheduled_at", "status"], managerOnly: false },
  inventory: { table: "inventory_items", columns: ["name", "category", "unit", "quantity", "reorder_threshold", "storage_location", "lot_number", "expires_on", "notes"], managerOnly: true }
};
function getResource(value: string | undefined): [Resource, typeof resources[Resource]] | null {
  if (!value || !(value in resources)) return null;
  const key = value as Resource;
  return [key, resources[key]];
}
function cleanValue(key: string, value: unknown): unknown {
  if (value === undefined) return undefined;
  if (["area_hectares", "quantity", "reorder_threshold"].includes(key)) {
    if (value === null || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : NaN;
  }
  if (value === null) return null;
  if (typeof value !== "string") return NaN;
  const v = value.trim();
  return v.length <= 2000 ? (v || null) : NaN;
}

export async function onRequestPatch({ request, env, params }: PagesContext): Promise<Response> {
  const resource = getResource(params?.resource);
  if (!resource) return errorResponse("Unknown resource.", 404);
  const member = await requireMember(request, env);
  if (!isMemberContext(member)) return member;
  if (member.role === "viewer" || (resource[1].managerOnly && !canManageFarmData(member.role))) {
    return errorResponse("Your role cannot edit this type of record.", 403);
  }
  const id = params?.id?.trim();
  if (!id || id.length > 128) return errorResponse("Invalid record ID.", 400);
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return errorResponse("Request body must be valid JSON.", 400); }

  const entries: [string, unknown][] = [];
  for (const key of resource[1].columns) {
    const value = cleanValue(key, body[key]);
    if (typeof value === "number" && Number.isNaN(value)) return errorResponse(`Invalid value for ${key}.`, 400);
    if (value !== undefined) entries.push([key, value]);
  }
  if (!entries.length) return errorResponse("No editable fields supplied.", 400);
  const sets = entries.map(([key]) => `${key} = ?`).join(", ");
  try {
    const result = await env.DB!.prepare(
      `UPDATE ${resource[1].table} SET ${sets}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ? AND organization_id = ?`
    ).bind(...entries.map(([, value]) => value), id, member.organizationId).run();
    const changed = (result as { meta?: { changes?: number } }).meta?.changes ?? 0;
    if (!changed) return errorResponse("Record not found.", 404);
    await env.DB!.prepare(
      `INSERT INTO audit_events (id, organization_id, actor_user_id, action, resource_type, resource_id)
       VALUES (?, ?, ?, 'update', ?, ?)`
    ).bind(crypto.randomUUID(), member.organizationId, member.userId, resource[0], id).run();
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return errorResponse("Could not update record. Check related IDs.", 400);
  }
}

export async function onRequestDelete({ request, env, params }: PagesContext): Promise<Response> {
  const resource = getResource(params?.resource);
  if (!resource) return errorResponse("Unknown resource.", 404);
  const member = await requireMember(request, env);
  if (!isMemberContext(member)) return member;
  if (member.role !== "owner" && member.role !== "admin") {
    return errorResponse("Only an owner or admin can delete records.", 403);
  }
  const id = params?.id?.trim();
  if (!id || id.length > 128) return errorResponse("Invalid record ID.", 400);
  try {
    const result = await env.DB!.prepare(
      `DELETE FROM ${resource[1].table} WHERE id = ? AND organization_id = ?`
    ).bind(id, member.organizationId).run();
    const changed = (result as { meta?: { changes?: number } }).meta?.changes ?? 0;
    if (!changed) return errorResponse("Record not found.", 404);
    await env.DB!.prepare(
      `INSERT INTO audit_events (id, organization_id, actor_user_id, action, resource_type, resource_id)
       VALUES (?, ?, ?, 'delete', ?, ?)`
    ).bind(crypto.randomUUID(), member.organizationId, member.userId, resource[0], id).run();
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch {
    return errorResponse("Could not delete record. Other records may depend on it.", 409);
  }
}
