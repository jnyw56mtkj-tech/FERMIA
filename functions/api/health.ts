interface D1Result {
  success: boolean;
}

interface D1Database {
  prepare(query: string): {
    first<T = unknown>(): Promise<T | null>;
  };
}

interface Env {
  DB?: D1Database;
}

interface PagesContext {
  env: Env;
}

export async function onRequestGet({ env }: PagesContext): Promise<Response> {
  if (!env.DB) {
    return Response.json(
      {
        ok: true,
        app: "FERMIA",
        database: "not_configured",
        message: "D1 binding DB is not configured yet."
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const result = await env.DB.prepare("SELECT 1 AS ok").first<D1Result>();
    if (!result) throw new Error("Database health query returned no result.");

    return Response.json(
      { ok: true, app: "FERMIA", database: "connected" },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return Response.json(
      { ok: false, app: "FERMIA", database: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
