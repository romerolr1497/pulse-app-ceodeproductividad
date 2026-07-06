import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Guarda/borra la suscripción push en Supabase usando la service_role key.
// Se hace en el servidor porque la tabla push_subscriptions tiene RLS activo
// y la anon key del cliente no puede escribir en ella.

function admin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Valida el access token del usuario y devuelve su id (o null si no es válido).
async function getUserId(db: SupabaseClient, token?: string | null): Promise<string | null> {
  if (!token) return null;
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user.id;
}

export async function POST(req: NextRequest) {
  const db = admin();
  if (!db) return NextResponse.json({ error: "missing supabase config" }, { status: 500 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const accessToken = body.accessToken as string | undefined;
  const subscription = body.subscription as { endpoint?: string } | undefined;
  const userId = await getUserId(db, accessToken);
  if (!userId) return NextResponse.json({ error: "Sesión no válida. Iniciá sesión de nuevo." }, { status: 401 });
  if (!subscription?.endpoint)
    return NextResponse.json({ error: "Falta la suscripción del navegador." }, { status: 400 });

  const { error } = await db.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: subscription.endpoint,
      subscription,
      routines: (body.routines as unknown[]) ?? [],
      notify_minutes: (body.notifyMinutes as number) ?? 10,
      wake_time: (body.wakeTime as string | null) ?? null,
      morning_motivation: (body.morningMotivation as boolean) ?? false,
      tz: (body.tz as string) ?? "America/Argentina/Buenos_Aires",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, registered: true });
}

export async function DELETE(req: NextRequest) {
  const db = admin();
  if (!db) return NextResponse.json({ error: "missing supabase config" }, { status: 500 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const accessToken = body.accessToken as string | undefined;
  const endpoint = body.endpoint as string | undefined;
  const userId = await getUserId(db, accessToken);
  if (!userId) return NextResponse.json({ error: "no auth" }, { status: 401 });
  if (!endpoint) return NextResponse.json({ error: "no endpoint" }, { status: 400 });

  await db.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", userId);
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const db = admin();
  if (!db) return NextResponse.json({ registered: false });

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  const endpoint = new URL(req.url).searchParams.get("endpoint") ?? "";
  const userId = await getUserId(db, token);
  if (!userId || !endpoint) return NextResponse.json({ registered: false });

  const { data } = await db
    .from("push_subscriptions")
    .select("endpoint")
    .eq("endpoint", endpoint)
    .eq("user_id", userId)
    .maybeSingle();

  return NextResponse.json({ registered: !!data });
}
