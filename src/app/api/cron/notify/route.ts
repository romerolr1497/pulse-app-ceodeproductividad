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
type CalEvent = {
  id: string;
  title: string;
  date: string;
  time?: string;
  notifyMinutes?: number;
  completed?: boolean;
};
type Reserva = {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime?: string;
  notifyMinutes?: number;
};
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
  const rid = Math.random().toString(36).slice(2, 8);
  const t0 = Date.now();
  const log = (msg: string, extra?: unknown) =>
    console.log(`[cron:${rid}] ${msg}`, extra !== undefined ? JSON.stringify(extra) : "");

  const url = new URL(req.url);
  const secret = url.searchParams.get("secret") || req.headers.get("x-cron-secret");
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    log("401 unauthorized");
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
    log("ERROR leyendo subs", { msg: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Eventos/turnos viven en app_state (fuente única). Los leemos para avisar antes.
  const eventsByUser = new Map<string, CalEvent[]>();
  const reservationsByUser = new Map<string, Reserva[]>();
  {
    const { data: stateRows } = await admin.from("app_state").select("user_id, data");
    for (const sr of (stateRows ?? []) as {
      user_id: string;
      data: { events?: CalEvent[]; reservations?: Reserva[] };
    }[]) {
      const evs = Array.isArray(sr.data?.events) ? sr.data.events : [];
      if (evs.length) eventsByUser.set(sr.user_id, evs);
      const res = Array.isArray(sr.data?.reservations) ? sr.data.reservations : [];
      if (res.length) reservationsByUser.set(sr.user_id, res);
    }
  }

  const rows = (data ?? []) as SubRow[];
  const now = new Date();
  let sent = 0;
  let morning = 0;
  let events = 0;
  let reservations = 0;
  let removed = 0;

  log("start", {
    subs: rows.length,
    usersWithEvents: eventsByUser.size,
    usersWithReservations: reservationsByUser.size,
    nowUtc: now.toISOString(),
  });

  for (const row of rows) {
    const tz = row.tz || "America/Argentina/Buenos_Aires";
    const nowMin = minutesOfDayInTz(now, tz);
    const dow = dayOfWeekInTz(now, tz);
    log("row", {
      user: row.user_id.slice(0, 8),
      tz,
      nowMin,
      dow,
      routines: row.routines?.length ?? 0,
      notifyMin: row.notify_minutes,
      wake: row.wake_time,
      morningOn: row.morning_motivation,
    });

    // 1) Buenos días motivacional a la hora de despertar
    const wake = row.wake_time ? parseHHMM(row.wake_time) : null;
    if (row.morning_motivation && wake !== null && wake >= nowMin && wake < nowMin + WINDOW_MIN) {
      const quote = STOIC_QUOTES[Math.floor(Math.random() * STOIC_QUOTES.length)];
      const goodMorning = JSON.stringify({
        title: "Buenos días ☀️",
        body: quote,
        url: "/",
        tag: `pulse-morning-${dateStrInTz(now, tz)}`,
      });
      try {
        await webpush.sendNotification(row.subscription, goodMorning);
        morning++;
        log("morning sent", { user: row.user_id.slice(0, 8) });
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode;
        log("morning FAIL", { status });
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("id", row.id);
          removed++;
          continue;
        }
      }
    }

    // 2) Recordatorios de eventos/turnos con aviso (viven en app_state)
    const userEvents = eventsByUser.get(row.user_id) ?? [];
    const todayStr = dateStrInTz(now, tz);
    for (const ev of userEvents) {
      if (ev.completed) continue;
      if (ev.date !== todayStr) continue;
      if (!ev.time || ev.notifyMinutes === undefined || ev.notifyMinutes === null) continue;
      const evMin = parseHHMM(ev.time);
      if (evMin === null) continue;
      const target = evMin - ev.notifyMinutes;
      if (!(target >= nowMin && target < nowMin + WINDOW_MIN)) continue;
      const evBody =
        ev.notifyMinutes > 0
          ? `${ev.title} — en ${ev.notifyMinutes} min (${ev.time})`
          : `${ev.title} — ahora (${ev.time})`;
      const evPayload = JSON.stringify({
        title: "Pulse · Agenda",
        body: evBody,
        url: "/agenda",
        tag: `event-${ev.id}`,
      });
      try {
        await webpush.sendNotification(row.subscription, evPayload);
        events++;
        log("event sent", { title: ev.title, time: ev.time });
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode;
        log("event FAIL", { status, title: ev.title });
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("id", row.id);
          removed++;
        }
      }
    }

    // 2b) Recordatorios de reservas (bloques de tiempo con aviso)
    const userReservations = reservationsByUser.get(row.user_id) ?? [];
    for (const rv of userReservations) {
      if (rv.date !== todayStr) continue;
      if (!rv.startTime || rv.notifyMinutes === undefined || rv.notifyMinutes === null) continue;
      const rvMin = parseHHMM(rv.startTime);
      if (rvMin === null) continue;
      const target = rvMin - rv.notifyMinutes;
      if (!(target >= nowMin && target < nowMin + WINDOW_MIN)) continue;
      const rvBody =
        rv.notifyMinutes > 0
          ? `${rv.title} — en ${rv.notifyMinutes} min (${rv.startTime})`
          : `${rv.title} — ahora (${rv.startTime})`;
      const rvPayload = JSON.stringify({
        title: "Pulse · Reserva",
        body: rvBody,
        url: "/agenda",
        tag: `reservation-${rv.id}`,
      });
      try {
        await webpush.sendNotification(row.subscription, rvPayload);
        reservations++;
        log("reservation sent", { title: rv.title, start: rv.startTime });
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode;
        log("reservation FAIL", { status, title: rv.title });
        if (status === 404 || status === 410) {
          await admin.from("push_subscriptions").delete().eq("id", row.id);
          removed++;
        }
      }
    }

    // 3) Recordatorios de rutina (respetando los días activos)
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

    const payload = JSON.stringify({
      title: "Pulse",
      body,
      url: "/",
      routineId: due.id,
      token,
      tag: due.id ? `routine-${due.id}` : "pulse-routine",
    });
    try {
      await webpush.sendNotification(row.subscription, payload);
      sent++;
      log("routine sent", { name: due.name, start: due.startTime });
    } catch (err: unknown) {
      const status = (err as { statusCode?: number })?.statusCode;
      log("routine FAIL", { status, name: due.name });
      if (status === 404 || status === 410) {
        await admin.from("push_subscriptions").delete().eq("id", row.id);
        removed++;
      }
    }
  }

  log("done", { ms: Date.now() - t0, checked: rows.length, sent, morning, events, reservations, removed });
  return NextResponse.json({ ok: true, checked: rows.length, sent, morning, events, reservations, removed });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
