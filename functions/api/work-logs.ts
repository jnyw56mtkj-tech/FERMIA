import { errorResponse, isMemberContext, requireMember, type PagesContext } from "./_lib/auth";

export async function onRequestGet({ request, env }: PagesContext): Promise<Response> {
  const member = await requireMember(request, env);
  if (!isMemberContext(member)) return member;
  try {
    const result = await env.DB!.prepare(
      `SELECT l.*, t.title AS task_title, f.name AS field_name
       FROM work_logs l
       LEFT JOIN work_tasks t ON t.id = l.task_id AND t.organization_id = l.organization_id
       LEFT JOIN fields f ON f.id = l.field_id AND f.organization_id = l.organization_id
       WHERE l.organization_id = ?
       ORDER BY l.work_date DESC, l.created_at DESC LIMIT 500`
    ).bind(member.organizationId).all();
    return Response.json({ items: result.results }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return errorResponse("Could not load work logs. Check that the database migration is applied.", 500);
  }
}

export async function onRequestPost({ request, env }: PagesContext): Promise<Response> {
  const member = await requireMember(request, env);
  if (!isMemberContext(member)) return member;
  if (member.role === "viewer") return errorResponse("Your role cannot create work logs.", 403);
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return errorResponse("Request body must be valid JSON.", 400); }

  const workDate = typeof body.work_date === "string" ? body.work_date.trim() : "";
  const duration = Number(body.duration_minutes);
  const taskId = typeof body.task_id === "string" && body.task_id.trim() ? body.task_id.trim() : null;
  const fieldId = typeof body.field_id === "string" && body.field_id.trim() ? body.field_id.trim() : null;
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate) || !Number.isInteger(duration) || duration < 1 || duration > 1440 || notes.length > 2000) {
    return errorResponse("Enter a valid date, duration (1–1440 minutes), and notes (up to 2000 characters).", 400);
  }

  const id = crypto.randomUUID();
  try {
    await env.DB!.prepare(
      `INSERT INTO work_logs (id, organization_id, task_id, field_id, user_id, work_date, duration_minutes, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, member.organizationId, taskId, fieldId, member.userId, workDate, duration, notes || null).run();
    await env.DB!.prepare(
      `INSERT INTO audit_events (id, organization_id, actor_user_id, action, resource_type, resource_id)
       VALUES (?, ?, ?, 'create', 'work_log', ?)`
    ).bind(crypto.randomUUID(), member.organizationId, member.userId, id).run();
    return Response.json({ item: { id, task_id: taskId, field_id: fieldId, user_id: member.userId, work_date: workDate, duration_minutes: duration, notes } }, {
      status: 201, headers: { "Cache-Control": "no-store" }
    });
  } catch {
    return errorResponse("Could not save the work log. Check that selected task and field belong to this organization.", 400);
  }
}
