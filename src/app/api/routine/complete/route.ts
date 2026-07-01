import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyActionToken } from "@/lib/cronToken";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RoutineBlock = { id: string; completed?: boolean };
type AppState = { routines?: RoutineBlock[] } & Record<string, unknown>;

async function handle(req: NextRequest) {
  let token: string | undefined;
  try {
    const body = await req.json();
    token = body?.token;
  } catch {
    const url = new URL(req.url);
    token = url.searchParams.get("token") ?? undefined;
  }
  if (!token) return NextResponse.json({ error: "missing token" }, { status: 400 });

  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "server misconfigured" }, { status: 500 });

  const payload = verifyActionToken(token, secret);
  if (!payload) return NextResponse.json({ error: "invalid token" }, { status: 401 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "missing supabase config" }, { status: 500 });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin
    .from("app_state")
    .select("data")
    .eq("user_id", payload.u)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.data) return NextResponse.json({ error: "no state" }, { status: 404 });

  const state = data.data as AppState;
  const routines = Array.isArray(state.routines) ? state.routines : [];
  const idx = routines.findIndex((r) => r.id === payload.r);
  if (idx === -1) return NextResponse.json({ ok: true, changed: false });

  routines[idx] = { ...routines[idx], completed: true };
  const nextState = { ...state, routines };

  const { error: upErr } = await admin.from("app_state").upsert({
    user_id: payload.u,
    data: nextState,
    updated_at: new Date().toISOString(),
  });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, changed: true });
}

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function GET(req: NextRequest) {
  return handle(req);
}
