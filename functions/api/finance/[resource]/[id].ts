import { errorResponse, isMemberContext, requireMember, type PagesContext } from "../../../_lib/auth";

type Resource = "customers" | "sales" | "expenses";
const resources: Record<Resource, { table: string; columns: string[] }> = {
  customers: { table: "customers", columns: ["name", "contact_name", "phone", "email", "address", "notes"] },
  sales: { table: "sales_records", columns: ["customer_id", "harvest_record_id", "sold_on", "product_name", "quantity", "unit", "unit_price", "amount", "payment_status", "notes"] },
  expenses: { table: "expense_records", columns: ["spent_on", "category", "vendor", "description", "amount", "payment_method", "notes"] }
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

export async function onRequestPatch({ request, env, params }: PagesContext): Promise<Response> {
  const resource = getResource(params?.resource);
  if (!resource) return errorResponse("Unknown finance resource.", 404);
  const member = await requireMember(request, env);
  if (!isMemberContext(member)) return member;
  if (denied(member.role)) return errorResponse("Only managers and administrators can edit finance records.", 403);
  const id = params?.id?.trim();
  if (!id || id.length > 128) return errorResponse("Invalid record ID.", 400);
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return errorResponse("Request body must be valid JSON.", 400); }
  const entries: [string, unknown][] = [];
  for (const key of resource[1].columns) {
    const value = clean(key, body[key]);
    if (typeof value === "number" && Number.isNaN(value)) return errorResponse(`Invalid value for ${key}.`, 400);
    if (value !== undefined) entries.push([key, value]);
  }
  if (!entries.length) return errorResponse("No editable fields supplied.", 400);
  if (resource[0] === "sales") {
    const proposed = Object.fromEntries(entries);
    if (proposed.payment_status !== undefined && !["unpaid", "partial", "paid"].includes(String(proposed.payment_status))) return errorResponse("Invalid payment status.", 400);
    if (proposed.customer_id) {
      const exists = await env.DB!.prepare("SELECT 1 FROM customers WHERE id = ? AND organization_id = ?").bind(proposed.customer_id, member.organizationId).first();
      if (!exists) return errorResponse("Customer not found in this organization.", 400);
    }
    if (proposed.harvest_record_id) {
      const exists = await env.DB!.prepare("SELECT 1 FROM harvest_records WHERE id = ? AND organization_id = ?").bind(proposed.harvest_record_id, member.organizationId).first();
      if (!exists) return errorResponse("Harvest record not found in this organization.", 400);
    }
  }
  const sets = entries.map(([key]) => `${key} = ?`).join(", ");
  try {
    const result = await env.DB!.prepare(`UPDATE ${resource[1].table} SET ${sets}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND organization_id = ?`)
      .bind(...entries.map(([, value]) => value), id, member.organizationId).run();
    const changed = (result as { meta?: { changes?: number } }).meta?.changes ?? 0;
    if (!changed) return errorResponse("Record not found.", 404);
    await env.DB!.prepare("INSERT INTO audit_events (id, organization_id, actor_user_id, action, resource_type, resource_id) VALUES (?, ?, ?, 'update', ?, ?)")
      .bind(crypto.randomUUID(), member.organizationId, member.userId, `finance_${resource[0]}`, id).run();
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return errorResponse("Could not update finance record. Check values and related records.", 400);
  }
}

export async function onRequestDelete({ request, env, params }: PagesContext): Promise<Response> {
  const resource = getResource(params?.resource);
  if (!resource) return errorResponse("Unknown finance resource.", 404);
  const member = await requireMember(request, env);
  if (!isMemberContext(member)) return member;
  if (member.role !== "owner" && member.role !== "admin") return errorResponse("Only an owner or admin can delete finance records.", 403);
  const id = params?.id?.trim();
  if (!id || id.length > 128) return errorResponse("Invalid record ID.", 400);
  try {
    const result = await env.DB!.prepare(`DELETE FROM ${resource[1].table} WHERE id = ? AND organization_id = ?`).bind(id, member.organizationId).run();
    const changed = (result as { meta?: { changes?: number } }).meta?.changes ?? 0;
    if (!changed) return errorResponse("Record not found.", 404);
    await env.DB!.prepare("INSERT INTO audit_events (id, organization_id, actor_user_id, action, resource_type, resource_id) VALUES (?, ?, ?, 'delete', ?, ?)")
      .bind(crypto.randomUUID(), member.organizationId, member.userId, `finance_${resource[0]}`, id).run();
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch {
    return errorResponse("Could not delete record. It may be referenced by another record.", 409);
  }
}
