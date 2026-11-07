import { errorResponse, isMemberContext, requireMember, type PagesContext } from "../_lib/auth";

export async function onRequestPatch({ request, env, params }: PagesContext): Promise<Response> {
  const member = await requireMember(request, env);
  if (!isMemberContext(member)) return member;
  if (member.role === "viewer") return errorResponse("Your role cannot edit work logs.", 403);
  const id = params?.id?.trim();
  if (!id || id.length > 128) return errorResponse("Invalid record ID.", 400);
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return errorResponse("Request body must be valid JSON.", 400); }
  const date = typeof body.work_date === "string" ? body.work_date.trim() : "";
  const duration = Number(body.duration_minutes);
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  const taskId = typeof body.task_id === "string" && body.task_id.trim() ? body.task_id.trim() : null;
  const fieldId = typeof body.field_id === "string" && body.field_id.trim() ? body.field_id.trim() : null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(duration) || duration < 1 || duration > 1440 || notes.length > 2000) {
    return errorResponse("Enter a valid date, duration (1–1440 minutes), and notes (up to 2000 characters).", 400);
  }
  try {
    const ownership = await env.DB!.prepare(
      "SELECT user_id FROM work_logs WHERE id = ? AND organization_id = ?"
    ).bind(id, member.organizationId).first<{ user_id: string | null }>();
    if (!ownership) return errorResponse("Record not found.", 404);
    if (!["owner", "admin", "manager"].includes(member.role) && ownership.user_id !== member.userId) {
      return errorResponse("You can only edit your own work logs.", 403);
    }
    await env.DB!.prepare(
      `UPDATE work_logs SET task_id = ?, field_id = ?, work_date = ?, duration_minutes = ?, notes = ?
       WHERE id = ? AND organization_id = ?`
    ).bind(taskId, fieldId, date, duration, notes || null, id, member.organizationId).run();
    await env.DB!.prepare(
      `INSERT INTO audit_events (id, organization_id, actor_user_id, action, resource_type, resource_id)
       VALUES (?, ?, ?, 'update', 'work_log', ?)`
    ).bind(crypto.randomUUID(), member.organizationId, member.userId, id).run();
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return errorResponse("Could not update work log. Check related IDs.", 400);
  }
}

export async function onRequestDelete({ request, env, params }: PagesContext): Promise<Response> {
  const member = await requireMember(request, env);
  if (!isMemberContext(member)) return member;
  const id = params?.id?.trim();
  if (!id || id.length > 128) return errorResponse("Invalid record ID.", 400);
  try {
    const ownership = await env.DB!.prepare(
      "SELECT user_id FROM work_logs WHERE id = ? AND organization_id = ?"
    ).bind(id, member.organizationId).first<{ user_id: string | null }>();
    if (!ownership) return errorResponse("Record not found.", 404);
    if (!["owner", "admin"].includes(member.role) && ownership.user_id !== member.userId) {
      return errorResponse("You can only delete your own work logs (owner/admin can delete any).", 403);
    }
    await env.DB!.prepare("DELETE FROM work_logs WHERE id = ? AND organization_id = ?")
      .bind(id, member.organizationId).run();
    await env.DB!.prepare(
      `INSERT INTO audit_events (id, organization_id, actor_user_id, action, resource_type, resource_id)
       VALUES (?, ?, ?, 'delete', 'work_log', ?)`
    ).bind(crypto.randomUUID(), member.organizationId, member.userId, id).run();
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch {
    return errorResponse("Could not delete work log.", 409);
  }
}
