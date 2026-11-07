import { errorResponse, isMemberContext, requireMember, type PagesContext } from "../../_lib/auth";

type Resource = "customers" | "sales" | "expenses";
const resources: Record<Resource, { table: string; columns: string[]; required: string[] }> = {
  customers: { table: "customers", columns: ["name", "contact_name", "phone", "email", "address", "notes"], required: ["name"] },
  sales: { table: "sales_records", columns: ["customer_id", "harvest_record_id", "sold_on", "product_name", "quantity", "unit", "unit_price", "amount", "payment_status", "notes"], required: ["sold_on", "product_name", "amount"] },
  expenses: { table: "expense_records", columns: ["spent_on", "category", "vendor", "description", "amount", "payment_method", "notes"], required: ["spent_on", "category", "description", "amount"] }
};
function getResource(value: string | undefined): [Resource, typeof resources[Resource]] | null {
  if (!value || !(value in resources)) return null;
  const key = value as Resource;
  return [key, resources[key]];
}
function clean(key: string, value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (["quantity", "unit_price", "amount"].includes(key)) {
    const n = Number(value);
    return Number.isFinite(n) && n >= (key === "amount" ? 0.01 : 0) ? n : NaN;
  }
  if (typeof value !== "string") return NaN;
  const v = value.trim();
  return v.length <= 2000 ? (v || null) : NaN;
}
function denied(role: string) { return role !== "owner" && role !== "admin" && role !== "manager"; }

export async function onRequestGet({ request, env, params }: PagesContext): Promise<Response> {
  const resource = getResource(params?.resource);
  if (!resource) return errorResponse("Unknown finance resource.", 404);
  const member = await requireMember(request, env);
  if (!isMemberContext(member)) return member;
  if (denied(member.role)) return errorResponse("Finance records are restricted to managers and administrators.", 403);
  const select = resource[0] === "sales"
    ? "SELECT s.*, c.name AS customer_name FROM sales_records s LEFT JOIN customers c ON c.id = s.customer_id AND c.organization_id = s.organization_id WHERE s.organization_id = ? ORDER BY s.sold_on DESC, s.created_at DESC LIMIT 500"
    : resource[0] === "expenses"
    ? "SELECT * FROM expense_records WHERE organization_id = ? ORDER BY spent_on DESC, created_at DESC LIMIT 500"
    : "SELECT * FROM customers WHERE organization_id = ? ORDER BY name COLLATE NOCASE LIMIT 500";
  try {
    const result = await env.DB!.prepare(select).bind(member.organizationId).all();
    return Response.json({ items: result.results }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return errorResponse("Could not load finance records. Apply migration 0003 first.", 500);
  }
}

export async function onRequestPost({ request, env, params }: PagesContext): Promise<Response> {
  const resource = getResource(params?.resource);
  if (!resource) return errorResponse("Unknown finance resource.", 404);
  const member = await requireMember(request, env);
  if (!isMemberContext(member)) return member;
  if (denied(member.role)) return errorResponse("Only managers and administrators can create finance records.", 403);
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return errorResponse("Request body must be valid JSON.", 400); }
  const values: Record<string, unknown> = {};
  for (const key of resource[1].columns) {
    const value = clean(key, body[key]);
    if (typeof value === "number" && Number.isNaN(value)) return errorResponse(`Invalid value for ${key}.`, 400);
    if (value !== undefined) values[key] = value;
  }
  for (const key of resource[1].required) {
    if (values[key] === null || values[key] === undefined || values[key] === "") return errorResponse(`${key} is required.`, 400);
  }
  if (resource[0] === "sales" && values.payment_status == null) values.payment_status = "unpaid";
  if (resource[0] === "sales" && !["unpaid", "partial", "paid"].includes(String(values.payment_status))) return errorResponse("Invalid payment status.", 400);
  if (resource[0] === "sales" && values.customer_id) {
    const exists = await env.DB!.prepare("SELECT 1 FROM customers WHERE id = ? AND organization_id = ?").bind(values.customer_id, member.organizationId).first();
    if (!exists) return errorResponse("Customer not found in this organization.", 400);
  }
  if (resource[0] === "sales" && values.harvest_record_id) {
    const exists = await env.DB!.prepare("SELECT 1 FROM harvest_records WHERE id = ? AND organization_id = ?").bind(values.harvest_record_id, member.organizationId).first();
    if (!exists) return errorResponse("Harvest record not found in this organization.", 400);
  }
  const id = crypto.randomUUID();
  const columns = ["id", "organization_id", ...Object.keys(values), "created_by"];
  const placeholders = columns.map(() => "?").join(", ");
  try {
    await env.DB!.prepare(`INSERT INTO ${resource[1].table} (${columns.join(", ")}) VALUES (${placeholders})`)
      .bind(id, member.organizationId, ...Object.values(values), member.userId).run();
    await env.DB!.prepare("INSERT INTO audit_events (id, organization_id, actor_user_id, action, resource_type, resource_id) VALUES (?, ?, ?, 'create', ?, ?)")
      .bind(crypto.randomUUID(), member.organizationId, member.userId, `finance_${resource[0]}`, id).run();
    return Response.json({ item: { id, ...values } }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch {
    return errorResponse("Could not create finance record. Check values and related records.", 400);
  }
}
