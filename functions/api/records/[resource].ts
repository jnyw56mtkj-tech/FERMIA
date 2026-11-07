import {
  canManageFarmData,
  errorResponse,
  isMemberContext,
  requireMember,
  type PagesContext
} from "../_lib/auth";

type Resource = "fields" | "crops" | "tasks" | "inventory";
type FieldDef = { table: string; columns: string[]; required: string[]; managerOnly: boolean };
const resources: Record<Resource, FieldDef> = {
  fields: {
    table: "fields",
    columns: ["farm_id", "name", "area_hectares", "soil_type", "water_source", "notes"],
    required: ["farm_id", "name"],
    managerOnly: true
  },
  crops: {
    table: "crop_cycles",
    columns: ["field_id", "crop_name", "variety", "season", "status", "planting_date", "expected_harvest_date", "actual_harvest_date", "notes"],
    required: ["field_id", "crop_name"],
    managerOnly: true
  },
  tasks: {
    table: "work_tasks",
    columns: ["farm_id", "field_id", "crop_cycle_id", "title", "description", "category", "scheduled_at", "status"],
    required: ["title"],
    managerOnly: false
  },
  inventory: {
    table: "inventory_items",
    columns: ["name", "category", "unit", "quantity", "reorder_threshold", "storage_location", "lot_number", "expires_on", "notes"],
    required: ["name", "category", "unit"],
    managerOnly: true
  }
};

function getResource(value: string | undefined): [Resource, FieldDef] | null {
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

export async function onRequestGet({ request, env, params }: PagesContext): Promise<Response> {
  const resource = getResource(params?.resource);
  if (!resource) return errorResponse("Unknown resource.", 404);
  const member = await requireMember(request, env);
  if (!isMemberContext(member)) return member;
  try {
    const result = await env.DB!.prepare(
      `SELECT * FROM ${resource[1].table} WHERE organization_id = ? ORDER BY created_at DESC LIMIT 500`
    ).bind(member.organizationId).all();
    return Response.json({ items: result.results }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return errorResponse("Could not load records. Check that the database migration is applied.", 500);
  }
}

export async function onRequestPost({ request, env, params }: PagesContext): Promise<Response> {
  const resource = getResource(params?.resource);
  if (!resource) return errorResponse("Unknown resource.", 404);
  const member = await requireMember(request, env);
  if (!isMemberContext(member)) return member;
  if (member.role === "viewer" || (resource[1].managerOnly && !canManageFarmData(member.role))) {
    return errorResponse("Your role cannot create this type of record.", 403);
  }

  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return errorResponse("Request body must be valid JSON.", 400); }

  const values: Record<string, unknown> = {};
  for (const key of resource[1].columns) {
    const value = cleanValue(key, body[key]);
    if (typeof value === "number" && Number.isNaN(value)) return errorResponse(`Invalid value for ${key}.`, 400);
    if (value !== undefined) values[key] = value;
  }
  for (const key of resource[1].required) {
    if (typeof values[key] !== "string" || !(values[key] as string).trim()) {
      return errorResponse(`${key} is required.`, 400);
    }
  }

  const id = crypto.randomUUID();
  const columns = ["id", "organization_id", ...Object.keys(values)];
  const placeholders = columns.map(() => "?").join(", ");
  try {
    await env.DB!.prepare(
      `INSERT INTO ${resource[1].table} (${columns.join(", ")}) VALUES (${placeholders})`
    ).bind(id, member.organizationId, ...Object.values(values)).run();
    await env.DB!.prepare(
      `INSERT INTO audit_events (id, organization_id, actor_user_id, action, resource_type, resource_id)
       VALUES (?, ?, ?, 'create', ?, ?)`
    ).bind(crypto.randomUUID(), member.organizationId, member.userId, resource[0], id).run();
    return Response.json({ item: { id, ...values } }, {
      status: 201, headers: { "Cache-Control": "no-store" }
    });
  } catch {
    return errorResponse("Could not create record. Check related IDs and required database setup.", 400);
  }
}
