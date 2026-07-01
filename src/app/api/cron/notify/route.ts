import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { signActionToken } from "@/lib/cronToken";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Ventana del cron en minutos: debe coincidir con la frecuencia con la que
// se llama a este endpoint (cada 1 min para máxima puntualidad).
const WINDOW_MIN = 1;

const STOIC_QUOTES = [
  "No es que tengamos poco tiempo, sino que perdemos mucho. — Séneca",
  "La felicidad de tu vida depende de la calidad de tus pensamientos. — Marco Aurelio",
  "No expliques tu filosofía. Encárnala. — Epicteto",
  "El obstáculo es el camino. — Marco Aurelio",
  "Empieza de una vez a vivir, y cuenta cada día como una vida entera. — Séneca",
  "No des explicaciones de cómo debe ser un buen hombre: sé uno. — Marco Aurelio",
  "Somos más fuertes de lo que creemos. Solo hay que empezar. — Epicteto",
  "La suerte es lo que sucede cuando la preparación se encuentra con la oportunidad. — Séneca",
  "Tienes poder sobre tu mente, no sobre los hechos externos. Date cuenta y hallarás fuerza. — Marco Aurelio",
  "Ninguna persona es libre si no es dueña de sí misma. — Epicteto",
  "El que teme la muerte nunca hará nada digno de un hombre vivo. — Séneca",
  "Haz cada acto de tu vida como si fuera el último. — Marco Aurelio",
  "Primero decide quién quieres ser. Luego, haz lo que debas hacer. — Epicteto",
  "La disciplina es elegir entre lo que quieres ahora y lo que quieres más. — (estoico)",
  "Despierta con la determinación, acuéstate con la satisfacción. — (estoico)",
];

type Routine = { id?: string; name: string; startTime: string; days?: number[] | null };
type SubRow = {
  id: string;
  user_id: string;
  endpoint: string;
  subscription: webpush.PushSubscription;
  routines: Routine[];
  notify_minutes: number;
  wake_time: string | null;
  morning_motivation: boolean | null;
  tz: string;
};

function minutesOfDayInTz(date: Date, tz: string): number {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = fmt.formatToParts(date);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h * 60 + m;
}

function dayOfWeekInTz(date: Date, tz: string): number {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(date);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[wd] ?? 0;
}

function dateStrInTz(date: Date, tz: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(date); // YYYY-MM-DD
}

function parseHHMM(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

async function handle(req: NextRequest) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret") || req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "missing supabase config" }, { status: 500 });
  }
  if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    return NextResponse.json({ error: "missing vapid config" }, { status: 500 });
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@pulse.app",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin
    .from("push_subscriptions")
    .select("id, user_id, endpoint, subscription, routines, notify_minutes, wake_time, morning_motivation, tz");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as SubRow[];
  const now = new Date();
  let sent = 0;
  let morning = 0;
  let removed = 0;

  for (const row of rows) {
    const tz = row.tz || "America/Argentina/Buenos_Aires";
    const nowMin = minutesOfDayInTz(now, tz);
    const dow = dayOfWeekInTz(now, tz);

    // 1) Buenos días motivacional a la hora de despertar
    const wake = row.wake_time ? parseHHMM(row.wake_time) : null;
    if (row.morning_motivation && wake !== null && wake >= nowMin && wake < nowMin + WINDOW_MIN) {
      const quote = STOIC_QUOTES[Math.floor(Math.random() * STOIC_QUOTES.length)];
      const goodMorning = JSON.stringify({ title: "Buenos días ☀️", body: quote, url: "/" });
      try {
        await webpush.sendNotification(row.subscription, goodMorning);
        morning++;
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("id", row.id);
          removed++;
          continue;
        }
      }
    }

    // 2) Recordatorios de rutina (respetando los días activos)
    const due = (row.routines ?? []).find((r) => {
      if (Array.isArray(r.days) && r.days.length > 0 && !r.days.includes(dow)) return false;
      const start = parseHHMM(r.startTime);
      if (start === null) return false;
      const target = start - (row.notify_minutes || 0);
      return target >= nowMin && target < nowMin + WINDOW_MIN;
    });
    if (!due) continue;

    const mins = row.notify_minutes || 0;
    const body =
      mins > 0
        ? `${due.name} arranca en ${mins} min (${due.startTime})`
        : `Arranca ${due.name} (${due.startTime})`;

    // Token firmado para permitir "Ya lo hice" desde la notificación.
    let token: string | undefined;
    if (due.id) {
      token = signActionToken(
        {
          u: row.user_id,
          r: due.id,
          d: dateStrInTz(now, tz),
          exp: Math.floor(now.getTime() / 1000) + 6 * 60 * 60, // 6 h
        },
        process.env.CRON_SECRET!
      );
    }

    const payload = JSON.stringify({ title: "Pulse", body, url: "/", routineId: due.id, token });
    try {
      await webpush.sendNotification(row.subscription, payload);
      sent++;
    } catch (err: unknown) {
      const status = (err as { statusCode?: number })?.statusCode;
      if (status === 404 || status === 410) {
        await admin.from("push_subscriptions").delete().eq("id", row.id);
        removed++;
      }
    }
  }

  return NextResponse.json({ ok: true, checked: rows.length, sent, morning, removed });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
