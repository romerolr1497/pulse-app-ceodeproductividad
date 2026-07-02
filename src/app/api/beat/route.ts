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

  return [
    "Sos Beat, el asistente de Pulse, la app de productividad de Lorenzo (español rioplatense, tono cercano y breve).",
    "Tu objetivo es ejecutar lo que el usuario pide usando las herramientas disponibles: crear/completar/borrar tareas (sueltas o dentro de un proyecto), crear/borrar proyectos, crear/editar/borrar/completar rutinas, escribir la nota del día y ajustar la configuración.",
    "Podés hacer varias acciones en un mismo pedido (llamá varias herramientas). Interpretá horas naturales (ej: '3 de la tarde' = 15:00, 'y media' = :30).",
    "Si el usuario solo pregunta algo sobre su día o su estado, respondé con el contexto sin usar herramientas.",
    "Si algo es ambiguo, asumí lo más razonable en vez de preguntar. No inventes proyectos ni rutinas que no existen.",
    `Fecha de hoy: ${ctx.today}. Hora actual: ${ctx.now}.`,
    `Proyectos existentes: ${projects}.`,
    `Rutinas existentes: ${routines}.`,
    `Tareas pendientes actuales: ${pending}.`,
  ].join("\n");
}

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY no configurada en el servidor." },
      { status: 500 }
    );
  }

  let body: BeatRequest;
  try {
    body = (await req.json()) as BeatRequest;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const message = (body.message ?? "").trim();
  if (!message) {
    return NextResponse.json({ error: "Mensaje vacío." }, { status: 400 });
  }
  const ctx = body.context;
  if (!ctx || !Array.isArray(ctx.projects)) {
    return NextResponse.json({ error: "Falta el contexto." }, { status: 400 });
  }

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

    // Sin herramientas: es una respuesta conversacional
    if (!choice || toolCalls.length === 0) {
      return NextResponse.json({
        reply: choice?.content?.trim() || "Listo.",
        actions: [],
      });
    }

    // Construimos las acciones a partir de los tool calls
    const { actions, results } = buildActions(toolCalls, ctx);

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
    } catch {
      reply = "";
    }

    if (!reply) {
      reply = results.map((r) => r.summary).join(" ");
    }

    return NextResponse.json({ reply, actions });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json(
      { error: `Beat no pudo procesar el pedido: ${msg}` },
      { status: 500 }
    );
  }
}
