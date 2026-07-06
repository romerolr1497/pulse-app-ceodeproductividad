import { NextResponse } from "next/server";
import OpenAI from "openai";
import { BEAT_TOOLS, buildActions, type BeatContext } from "@/lib/beat/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = "gpt-4o-mini";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface BeatRequest {
  message: string;
  context: BeatContext;
  history?: ChatMessage[];
}

function systemPrompt(ctx: BeatContext): string {
  const projects = ctx.projects.map((p) => p.name).join(", ") || "ninguno";
  const routines = ctx.routines
    .map((r) => `${r.name} (${r.startTime}-${r.endTime})`)
    .join("; ") || "ninguna";
  const pending = ctx.pendingTasks.map((t) => t.title).join("; ") || "ninguna";
  const events =
    ctx.events
      .map((e) => `${e.date}${e.time ? " " + e.time : ""}: ${e.title}`)
      .join("; ") || "ninguno";
  const reservations =
    (ctx.reservations ?? [])
      .map((r) => `${r.date} ${r.startTime}${r.endTime ? "-" + r.endTime : ""}: ${r.title}`)
      .join("; ") || "ninguna";
  const flexRoutines =
    (ctx.flexRoutines ?? []).map((f) => f.name).join(", ") || "ninguna";

  // Tabla de fechas de referencia (próximos 14 días) para resolver "mañana", "el jueves", etc.
  const dayNames = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const base = new Date(ctx.today + "T00:00:00");
  const refDates: string[] = [];
  for (let i = 0; i < 15; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const label = i === 0 ? "hoy" : i === 1 ? "mañana" : i === 2 ? "pasado mañana" : dayNames[d.getDay()];
    refDates.push(`${label} = ${y}-${m}-${day}`);
  }

  return [
    "Sos Beat, el asistente de Pulse, la app de productividad de Lorenzo (español rioplatense, tono cercano y breve).",
    "Tu objetivo es ejecutar lo que el usuario pide usando las herramientas disponibles: crear/completar/borrar tareas (sueltas o dentro de un proyecto), crear/borrar proyectos, crear/editar/borrar/completar rutinas, agendar/editar/borrar eventos y turnos con fecha exacta, reservar bloques de tiempo, crear/marcar rutinas flexibles, escribir la nota del día y ajustar la configuración.",
    "Diferencia clave: una RUTINA es un bloque recurrente del día con horario (se repite); un EVENTO/TURNO es una cita puntual con fecha exacta (ej: turno médico el jueves 10:00); una RESERVA es un bloque de tiempo con prioridad pero tentativo/solapable (ej: 'reservá de 15 a 17 para el proyecto'); una RUTINA FLEXIBLE es un hábito sin hora ni día fijo que se marca cuando se hace (ej: deporte). Elegí la herramienta correcta según lo que describa el usuario.",
    "Podés hacer varias acciones en un mismo pedido (llamá varias herramientas). Interpretá horas naturales (ej: '3 de la tarde' = 15:00, 'y media' = :30).",
    "Para las fechas usá SIEMPRE el formato YYYY-MM-DD calculándolo con esta tabla de referencia:",
    refDates.join(" | "),
    "Si el usuario solo pregunta algo sobre su día, su semana o su agenda, respondé con el contexto sin usar herramientas.",
    "Si algo es ambiguo, asumí lo más razonable en vez de preguntar. No inventes proyectos, rutinas ni eventos que no existen.",
    `Fecha de hoy: ${ctx.today} (${ctx.weekday}). Hora actual: ${ctx.now}.`,
    `Proyectos existentes: ${projects}.`,
    `Rutinas existentes: ${routines}.`,
    `Tareas pendientes actuales: ${pending}.`,
    `Eventos/turnos agendados (próximos): ${events}.`,
    `Reservas (próximas): ${reservations}.`,
    `Rutinas flexibles: ${flexRoutines}.`,
  ].join("\n");
}

export async function POST(req: Request) {
  const rid = Math.random().toString(36).slice(2, 8);
  const t0 = Date.now();
  const log = (msg: string, extra?: unknown) =>
    console.log(`[beat:${rid}] ${msg}`, extra !== undefined ? JSON.stringify(extra) : "");

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    log("ERROR sin OPENAI_API_KEY");
    return NextResponse.json(
      { error: "OPENAI_API_KEY no configurada en el servidor." },
      { status: 500 }
    );
  }

  let body: BeatRequest;
  try {
    body = (await req.json()) as BeatRequest;
  } catch {
    log("ERROR json inválido");
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const message = (body.message ?? "").trim();
  if (!message) {
    log("ERROR mensaje vacío");
    return NextResponse.json({ error: "Mensaje vacío." }, { status: 400 });
  }
  const ctx = body.context;
  if (!ctx || !Array.isArray(ctx.projects)) {
    log("ERROR falta contexto");
    return NextResponse.json({ error: "Falta el contexto." }, { status: 400 });
  }

  log("IN", {
    message,
    today: ctx.today,
    weekday: ctx.weekday,
    now: ctx.now,
    projects: ctx.projects.length,
    routines: ctx.routines.length,
    pending: ctx.pendingTasks.length,
    events: ctx.events?.length ?? 0,
    history: body.history?.length ?? 0,
  });

  const openai = new OpenAI({ apiKey });

  const history = (body.history ?? [])
    .slice(-8)
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && m.content);

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt(ctx) },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: message },
  ];

  try {
    const first = await openai.chat.completions.create({
      model: MODEL,
      messages,
      tools: BEAT_TOOLS,
      tool_choice: "auto",
      temperature: 0.3,
    });

    const choice = first.choices[0]?.message;
    const toolCalls = choice?.tool_calls ?? [];
    log("openai#1", {
      finish: first.choices[0]?.finish_reason,
      toolCalls: toolCalls.map((c) => (c.type === "function" ? c.function.name : c.type)),
      usage: first.usage?.total_tokens,
    });

    // Sin herramientas: es una respuesta conversacional
    if (!choice || toolCalls.length === 0) {
      const reply = choice?.content?.trim() || "Listo.";
      log("OUT conversacional", { ms: Date.now() - t0, reply });
      return NextResponse.json({
        reply,
        actions: [],
      });
    }

    // Construimos las acciones a partir de los tool calls
    const { actions, results } = buildActions(toolCalls, ctx);
    log("actions", {
      count: actions.length,
      types: actions.map((a) => a.type),
      results: results.map((r) => r.summary),
    });

    // Segunda llamada: le pasamos los resultados para que redacte una confirmación natural
    const followupMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      ...messages,
      choice,
      ...results.map((r) => ({
        role: "tool" as const,
        tool_call_id: r.tool_call_id,
        content: r.summary,
      })),
    ];

    let reply = "";
    try {
      const second = await openai.chat.completions.create({
        model: MODEL,
        messages: followupMessages,
        temperature: 0.4,
      });
      reply = second.choices[0]?.message?.content?.trim() ?? "";
    } catch (e) {
      log("openai#2 ERROR", { msg: e instanceof Error ? e.message : "?" });
      reply = "";
    }

    if (!reply) {
      reply = results.map((r) => r.summary).join(" ");
    }

    log("OUT", { ms: Date.now() - t0, actions: actions.length, reply });
    return NextResponse.json({ reply, actions });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    log("FATAL", { ms: Date.now() - t0, msg });
    return NextResponse.json(
      { error: `Beat no pudo procesar el pedido: ${msg}` },
      { status: 500 }
    );
  }
}
