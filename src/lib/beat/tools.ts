import type OpenAI from "openai";
import type { CalendarEvent, Reservation, FlexRoutine } from "../types";

// Contexto que el cliente envía para que Beat resuelva nombres → ids
export interface BeatContext {
  today: string; // YYYY-MM-DD (hora local)
  now: string; // HH:mm
  weekday: string; // nombre del día de hoy (ej "lunes")
  projects: { id: string; name: string }[];
  routines: {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
    days?: number[];
  }[];
  pendingTasks: { id: string; title: string; projectId?: string }[];
  events: {
    id: string;
    title: string;
    date: string;
    time?: string;
    notes?: string;
    notifyMinutes?: number;
  }[];
  reservations: {
    id: string;
    title: string;
    date: string;
    startTime: string;
    endTime?: string;
    notifyMinutes?: number;
  }[];
  flexRoutines: { id: string; name: string }[];
}

// Acciones que Beat puede emitir (subconjunto seguro del reducer del store)
export type BeatAction =
  | { type: "ADD_TASK"; task: NewTask }
  | { type: "TOGGLE_TASK"; id: string }
  | { type: "DELETE_TASK"; id: string }
  | { type: "ADD_PROJECT"; project: NewProject }
  | { type: "DELETE_PROJECT"; id: string }
  | { type: "ADD_PROJECT_TASK"; projectId: string; task: NewTask }
  | { type: "TOGGLE_PROJECT_TASK"; projectId: string; taskId: string }
  | { type: "DELETE_PROJECT_TASK"; projectId: string; taskId: string }
  | { type: "ADD_ROUTINE"; routine: NewRoutine }
  | { type: "UPDATE_ROUTINE"; routine: NewRoutine }
  | { type: "DELETE_ROUTINE"; id: string }
  | { type: "TOGGLE_ROUTINE"; id: string }
  | { type: "ADD_EVENT"; event: CalendarEvent }
  | { type: "UPDATE_EVENT"; event: CalendarEvent }
  | { type: "DELETE_EVENT"; id: string }
  | { type: "ADD_RESERVATION"; reservation: Reservation }
  | { type: "UPDATE_RESERVATION"; reservation: Reservation }
  | { type: "DELETE_RESERVATION"; id: string }
  | { type: "ADD_FLEX_ROUTINE"; flexRoutine: FlexRoutine }
  | { type: "TOGGLE_FLEX_ROUTINE"; id: string; date: string }
  | { type: "SET_NOTE"; date: string; text: string }
  | { type: "UPDATE_SETTINGS"; settings: Record<string, unknown> };

interface NewTask {
  id: string;
  title: string;
  completed: boolean;
  priority: 1 | 2 | 3;
  createdAt: string;
  project?: string;
}
interface NewProject {
  id: string;
  name: string;
  color: string;
  tasks: never[];
}
interface NewRoutine {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  color: string;
  days?: number[];
}

const PALETTE = [
  "#e5a01e", "#22c55e", "#3b82f6", "#8b5cf6",
  "#ec4899", "#f59e0b", "#14b8a6", "#ef4444",
];

function norm(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function randomColor(): string {
  return PALETTE[Math.floor(Math.random() * PALETTE.length)];
}

function uuid(): string {
  return globalThis.crypto.randomUUID();
}

// Busca por nombre normalizado (coincidencia parcial en ambos sentidos)
function findByName<T extends { name?: string; title?: string }>(
  items: T[],
  query: string
): T | undefined {
  const q = norm(query);
  if (!q) return undefined;
  let best: T | undefined;
  for (const it of items) {
    const name = norm((it.name ?? it.title) as string);
    if (name === q) return it;
    if (name.includes(q) || q.includes(name)) {
      if (!best) best = it;
    }
  }
  return best;
}

function clampPriority(p: unknown): 1 | 2 | 3 {
  const n = Number(p);
  if (n === 1 || n === 3) return n;
  return 2;
}

function normalizeDays(days: unknown): number[] | undefined {
  if (!Array.isArray(days)) return undefined;
  const out = days
    .map((d) => Number(d))
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  if (out.length === 0 || out.length === 7) return undefined;
  return Array.from(new Set(out)).sort((a, b) => a - b);
}

// Definición de las herramientas que Beat expone al modelo
export const BEAT_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "add_task",
      description:
        "Agregar una tarea pendiente suelta (no asociada a un proyecto).",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Texto de la tarea" },
          priority: {
            type: "integer",
            enum: [1, 2, 3],
            description: "1=alta, 2=normal, 3=baja. Default 2.",
          },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_project_task",
      description: "Agregar una tarea dentro de un proyecto existente.",
      parameters: {
        type: "object",
        properties: {
          project: { type: "string", description: "Nombre del proyecto" },
          title: { type: "string", description: "Texto de la tarea" },
          priority: { type: "integer", enum: [1, 2, 3] },
        },
        required: ["project", "title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "complete_task",
      description:
        "Marcar como completada una tarea existente (suelta o de proyecto), identificada por su texto.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Texto de la tarea a completar" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_task",
      description: "Borrar una tarea existente identificada por su texto.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_project",
      description: "Crear un proyecto nuevo.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          color: {
            type: "string",
            description: "Color hex opcional, ej #3b82f6",
          },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_project",
      description: "Borrar un proyecto existente por su nombre.",
      parameters: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_routine",
      description:
        "Crear un bloque de rutina en la agenda diaria con hora de inicio y fin.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          startTime: { type: "string", description: "Hora inicio HH:mm (24h)" },
          endTime: { type: "string", description: "Hora fin HH:mm (24h)" },
          days: {
            type: "array",
            items: { type: "integer", enum: [0, 1, 2, 3, 4, 5, 6] },
            description:
              "Días activos: 0=domingo..6=sábado. Omitir para todos los días.",
          },
          color: { type: "string", description: "Color hex opcional" },
        },
        required: ["name", "startTime", "endTime"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_routine",
      description:
        "Editar una rutina existente (identificada por su nombre actual). Solo cambia los campos provistos.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nombre actual de la rutina" },
          newName: { type: "string" },
          startTime: { type: "string" },
          endTime: { type: "string" },
          days: {
            type: "array",
            items: { type: "integer", enum: [0, 1, 2, 3, 4, 5, 6] },
          },
          color: { type: "string" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_routine",
      description: "Borrar una rutina por su nombre.",
      parameters: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "complete_routine",
      description: "Marcar una rutina como completada hoy, por su nombre.",
      parameters: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_event",
      description:
        "Agendar un evento o turno puntual con fecha exacta (ej: turno médico, reunión, cumpleaños). Distinto de una rutina recurrente.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "De qué es el evento" },
          date: {
            type: "string",
            description:
              "Fecha en formato YYYY-MM-DD. Calculala a partir de la fecha de hoy provista (ej 'mañana', 'el jueves', 'el 15').",
          },
          time: { type: "string", description: "Hora HH:mm (24h). Omitir si es todo el día." },
          notes: { type: "string", description: "Nota opcional" },
          notifyMinutes: {
            type: "integer",
            description: "Avisar estos minutos antes (ej 30). Omitir si no quiere aviso.",
          },
        },
        required: ["title", "date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_event",
      description:
        "Editar un evento/turno existente identificado por su título (y opcionalmente su fecha). Solo cambia los campos provistos.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título actual del evento a editar" },
          onDate: { type: "string", description: "Fecha actual del evento YYYY-MM-DD (para desambiguar)" },
          newTitle: { type: "string" },
          date: { type: "string", description: "Nueva fecha YYYY-MM-DD" },
          time: { type: "string", description: "Nueva hora HH:mm" },
          notes: { type: "string" },
          notifyMinutes: { type: "integer" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_event",
      description: "Borrar un evento/turno por su título (y opcionalmente su fecha).",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          onDate: { type: "string", description: "Fecha del evento YYYY-MM-DD (opcional)" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_reservation",
      description:
        "Reservar un bloque de tiempo con prioridad para un día (ej: 'reservá de 15 a 17 para trabajar en el proyecto X'). Es tentativo y se puede pisar con un turno/evento; NO es una tarea ni un evento fijo.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Para qué es el bloque reservado" },
          date: {
            type: "string",
            description: "Fecha YYYY-MM-DD. Calculala a partir de hoy (ej 'mañana', 'el jueves').",
          },
          startTime: { type: "string", description: "Hora inicio HH:mm (24h)" },
          endTime: { type: "string", description: "Hora fin HH:mm (24h), opcional" },
          notes: { type: "string", description: "Nota opcional" },
          notifyMinutes: {
            type: "integer",
            description: "Avisar estos minutos antes del inicio. Omitir si no quiere aviso.",
          },
        },
        required: ["title", "startTime"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_reservation",
      description:
        "Editar una reserva existente identificada por su título (y opcionalmente su fecha). Solo cambia los campos provistos.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título actual de la reserva" },
          onDate: { type: "string", description: "Fecha actual YYYY-MM-DD (para desambiguar)" },
          newTitle: { type: "string" },
          date: { type: "string", description: "Nueva fecha YYYY-MM-DD" },
          startTime: { type: "string" },
          endTime: { type: "string" },
          notes: { type: "string" },
          notifyMinutes: { type: "integer" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_reservation",
      description: "Borrar una reserva por su título (y opcionalmente su fecha).",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          onDate: { type: "string", description: "Fecha YYYY-MM-DD (opcional)" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_flex_routine",
      description:
        "Crear una rutina flexible: un hábito sin hora ni día fijo que se marca cuando se hace (ej: deporte, meditar, leer). Distinto de una rutina con horario.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nombre del hábito" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "complete_flex_routine",
      description:
        "Marcar una rutina flexible como hecha hoy, por su nombre (ej: 'ya hice deporte').",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_daily_note",
      description: "Escribir o reemplazar la nota/reflexión del día.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string" },
          date: { type: "string", description: "YYYY-MM-DD, default hoy" },
        },
        required: ["text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_settings",
      description:
        "Ajustar configuración: hora de despertar (wakeTime HH:mm), notificaciones on/off (notifications), minutos de anticipación (notifyMinutesBefore), frase motivacional matutina (morningMotivation).",
      parameters: {
        type: "object",
        properties: {
          wakeTime: { type: "string", description: "HH:mm" },
          notifications: { type: "boolean" },
          notifyMinutesBefore: { type: "integer" },
          morningMotivation: { type: "boolean" },
        },
      },
    },
  },
];

export interface ToolResult {
  tool_call_id: string;
  summary: string; // qué pasó, para que el modelo redacte la respuesta
}

/**
 * Convierte los tool_calls del modelo en acciones del store, resolviendo
 * nombres → ids con el contexto. Devuelve también un resumen por cada call
 * para que el modelo redacte una confirmación natural.
 */
export function buildActions(
  toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[],
  ctx: BeatContext
): { actions: BeatAction[]; results: ToolResult[] } {
  const actions: BeatAction[] = [];
  const results: ToolResult[] = [];
  // Proyectos visibles para resolver nombres → incluye los creados en esta
  // misma tanda, para que "creá proyecto X y agregá tarea a X" funcione.
  const dynamicProjects = ctx.projects.map((p) => ({ id: p.id, name: p.name }));

  for (const call of toolCalls) {
    if (call.type !== "function") continue;
    const id = call.id;
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(call.function.arguments || "{}");
    } catch {
      results.push({ tool_call_id: id, summary: "Error: argumentos inválidos." });
      continue;
    }
    const name = call.function.name;

    switch (name) {
      case "add_task": {
        const title = String(args.title ?? "").trim();
        if (!title) {
          results.push({ tool_call_id: id, summary: "Falta el texto de la tarea." });
          break;
        }
        actions.push({
          type: "ADD_TASK",
          task: {
            id: uuid(),
            title,
            completed: false,
            priority: clampPriority(args.priority),
            createdAt: new Date().toISOString(),
          },
        });
        results.push({ tool_call_id: id, summary: `Tarea agregada: "${title}".` });
        break;
      }

      case "add_project_task": {
        const title = String(args.title ?? "").trim();
        const proj = findByName(dynamicProjects, String(args.project ?? ""));
        if (!title) {
          results.push({ tool_call_id: id, summary: "Falta el texto de la tarea." });
          break;
        }
        if (!proj) {
          results.push({
            tool_call_id: id,
            summary: `No existe un proyecto llamado "${args.project}". Proyectos: ${dynamicProjects
              .map((p) => p.name)
              .join(", ") || "ninguno"}.`,
          });
          break;
        }
        actions.push({
          type: "ADD_PROJECT_TASK",
          projectId: proj.id,
          task: {
            id: uuid(),
            title,
            completed: false,
            priority: clampPriority(args.priority),
            createdAt: new Date().toISOString(),
            project: proj.id,
          },
        });
        results.push({
          tool_call_id: id,
          summary: `Tarea "${title}" agregada al proyecto ${proj.name}.`,
        });
        break;
      }

      case "complete_task": {
        const task = findByName(ctx.pendingTasks, String(args.title ?? ""));
        if (!task) {
          results.push({
            tool_call_id: id,
            summary: `No encontré una tarea pendiente que diga "${args.title}".`,
          });
          break;
        }
        if (task.projectId) {
          actions.push({ type: "TOGGLE_PROJECT_TASK", projectId: task.projectId, taskId: task.id });
        } else {
          actions.push({ type: "TOGGLE_TASK", id: task.id });
        }
        results.push({ tool_call_id: id, summary: `Tarea completada: "${task.title}".` });
        break;
      }

      case "delete_task": {
        const task = findByName(ctx.pendingTasks, String(args.title ?? ""));
        if (!task) {
          results.push({
            tool_call_id: id,
            summary: `No encontré una tarea que diga "${args.title}".`,
          });
          break;
        }
        if (task.projectId) {
          actions.push({ type: "DELETE_PROJECT_TASK", projectId: task.projectId, taskId: task.id });
        } else {
          actions.push({ type: "DELETE_TASK", id: task.id });
        }
        results.push({ tool_call_id: id, summary: `Tarea borrada: "${task.title}".` });
        break;
      }

      case "add_project": {
        const pname = String(args.name ?? "").trim();
        if (!pname) {
          results.push({ tool_call_id: id, summary: "Falta el nombre del proyecto." });
          break;
        }
        const newProjectId = uuid();
        actions.push({
          type: "ADD_PROJECT",
          project: {
            id: newProjectId,
            name: pname,
            color: typeof args.color === "string" ? args.color : randomColor(),
            tasks: [],
          },
        });
        dynamicProjects.push({ id: newProjectId, name: pname });
        results.push({ tool_call_id: id, summary: `Proyecto creado: ${pname}.` });
        break;
      }

      case "delete_project": {
        const proj = findByName(ctx.projects, String(args.name ?? ""));
        if (!proj) {
          results.push({ tool_call_id: id, summary: `No existe el proyecto "${args.name}".` });
          break;
        }
        actions.push({ type: "DELETE_PROJECT", id: proj.id });
        results.push({ tool_call_id: id, summary: `Proyecto borrado: ${proj.name}.` });
        break;
      }

      case "add_routine": {
        const rname = String(args.name ?? "").trim();
        const startTime = String(args.startTime ?? "").trim();
        const endTime = String(args.endTime ?? "").trim();
        if (!rname || !startTime || !endTime) {
          results.push({
            tool_call_id: id,
            summary: "Faltan datos de la rutina (nombre, inicio o fin).",
          });
          break;
        }
        actions.push({
          type: "ADD_ROUTINE",
          routine: {
            id: uuid(),
            name: rname,
            startTime,
            endTime,
            color: typeof args.color === "string" ? args.color : randomColor(),
            days: normalizeDays(args.days),
          },
        });
        results.push({
          tool_call_id: id,
          summary: `Rutina agregada: ${rname} (${startTime}-${endTime}).`,
        });
        break;
      }

      case "update_routine": {
        const current = findByName(ctx.routines, String(args.name ?? ""));
        if (!current) {
          results.push({ tool_call_id: id, summary: `No encontré la rutina "${args.name}".` });
          break;
        }
        const days =
          args.days !== undefined ? normalizeDays(args.days) : current.days;
        actions.push({
          type: "UPDATE_ROUTINE",
          routine: {
            id: current.id,
            name: typeof args.newName === "string" && args.newName.trim() ? args.newName.trim() : current.name,
            startTime: typeof args.startTime === "string" && args.startTime ? args.startTime : current.startTime,
            endTime: typeof args.endTime === "string" && args.endTime ? args.endTime : current.endTime,
            color: typeof args.color === "string" ? args.color : randomColor(),
            days,
          },
        });
        results.push({ tool_call_id: id, summary: `Rutina "${current.name}" actualizada.` });
        break;
      }

      case "delete_routine": {
        const current = findByName(ctx.routines, String(args.name ?? ""));
        if (!current) {
          results.push({ tool_call_id: id, summary: `No encontré la rutina "${args.name}".` });
          break;
        }
        actions.push({ type: "DELETE_ROUTINE", id: current.id });
        results.push({ tool_call_id: id, summary: `Rutina borrada: ${current.name}.` });
        break;
      }

      case "complete_routine": {
        const current = findByName(ctx.routines, String(args.name ?? ""));
        if (!current) {
          results.push({ tool_call_id: id, summary: `No encontré la rutina "${args.name}".` });
          break;
        }
        actions.push({ type: "TOGGLE_ROUTINE", id: current.id });
        results.push({ tool_call_id: id, summary: `Rutina marcada: ${current.name}.` });
        break;
      }

      case "add_event": {
        const title = String(args.title ?? "").trim();
        const date =
          typeof args.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(args.date)
            ? args.date
            : ctx.today;
        if (!title) {
          results.push({ tool_call_id: id, summary: "Falta el título del evento." });
          break;
        }
        const time =
          typeof args.time === "string" && /^\d{1,2}:\d{2}$/.test(args.time)
            ? args.time
            : undefined;
        const notifyMinutes =
          typeof args.notifyMinutes === "number" && args.notifyMinutes > 0
            ? args.notifyMinutes
            : undefined;
        actions.push({
          type: "ADD_EVENT",
          event: {
            id: uuid(),
            title,
            date,
            time,
            notes: typeof args.notes === "string" ? args.notes : undefined,
            notifyMinutes,
            color: "#e5a01e",
          },
        });
        results.push({
          tool_call_id: id,
          summary: `Evento agendado: "${title}" el ${date}${time ? ` a las ${time}` : ""}.`,
        });
        break;
      }

      case "update_event": {
        const onDate =
          typeof args.onDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(args.onDate)
            ? args.onDate
            : undefined;
        const pool = onDate ? ctx.events.filter((e) => e.date === onDate) : ctx.events;
        const found = findByName(pool, String(args.title ?? ""));
        if (!found) {
          results.push({ tool_call_id: id, summary: `No encontré el evento "${args.title}".` });
          break;
        }
        const newDate =
          typeof args.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(args.date)
            ? args.date
            : found.date;
        const newTime =
          typeof args.time === "string" && /^\d{1,2}:\d{2}$/.test(args.time)
            ? args.time
            : found.time;
        actions.push({
          type: "UPDATE_EVENT",
          event: {
            id: found.id,
            title:
              typeof args.newTitle === "string" && args.newTitle.trim()
                ? args.newTitle.trim()
                : found.title,
            date: newDate,
            time: newTime,
            notes: typeof args.notes === "string" ? args.notes : found.notes,
            notifyMinutes:
              typeof args.notifyMinutes === "number"
                ? args.notifyMinutes
                : found.notifyMinutes,
            color: "#e5a01e",
          },
        });
        results.push({ tool_call_id: id, summary: `Evento "${found.title}" actualizado.` });
        break;
      }

      case "delete_event": {
        const onDate =
          typeof args.onDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(args.onDate)
            ? args.onDate
            : undefined;
        const pool = onDate ? ctx.events.filter((e) => e.date === onDate) : ctx.events;
        const found = findByName(pool, String(args.title ?? ""));
        if (!found) {
          results.push({ tool_call_id: id, summary: `No encontré el evento "${args.title}".` });
          break;
        }
        actions.push({ type: "DELETE_EVENT", id: found.id });
        results.push({ tool_call_id: id, summary: `Evento borrado: "${found.title}".` });
        break;
      }

      case "add_reservation": {
        const title = String(args.title ?? "").trim();
        const startTime =
          typeof args.startTime === "string" && /^\d{1,2}:\d{2}$/.test(args.startTime)
            ? args.startTime
            : "";
        if (!title || !startTime) {
          results.push({ tool_call_id: id, summary: "Falta el título o la hora de inicio de la reserva." });
          break;
        }
        const date =
          typeof args.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(args.date)
            ? args.date
            : ctx.today;
        const endTime =
          typeof args.endTime === "string" && /^\d{1,2}:\d{2}$/.test(args.endTime)
            ? args.endTime
            : undefined;
        const notifyMinutes =
          typeof args.notifyMinutes === "number" && args.notifyMinutes > 0
            ? args.notifyMinutes
            : undefined;
        actions.push({
          type: "ADD_RESERVATION",
          reservation: {
            id: uuid(),
            title,
            date,
            startTime,
            endTime,
            notes: typeof args.notes === "string" ? args.notes : undefined,
            notifyMinutes,
            color: "#a78bfa",
          },
        });
        results.push({
          tool_call_id: id,
          summary: `Reserva creada: "${title}" el ${date} ${startTime}${endTime ? `–${endTime}` : ""}.`,
        });
        break;
      }

      case "update_reservation": {
        const onDate =
          typeof args.onDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(args.onDate)
            ? args.onDate
            : undefined;
        const pool = onDate ? ctx.reservations.filter((r) => r.date === onDate) : ctx.reservations;
        const found = findByName(pool, String(args.title ?? ""));
        if (!found) {
          results.push({ tool_call_id: id, summary: `No encontré la reserva "${args.title}".` });
          break;
        }
        const newDate =
          typeof args.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(args.date)
            ? args.date
            : found.date;
        const newStart =
          typeof args.startTime === "string" && /^\d{1,2}:\d{2}$/.test(args.startTime)
            ? args.startTime
            : found.startTime;
        const newEnd =
          typeof args.endTime === "string" && /^\d{1,2}:\d{2}$/.test(args.endTime)
            ? args.endTime
            : found.endTime;
        actions.push({
          type: "UPDATE_RESERVATION",
          reservation: {
            id: found.id,
            title:
              typeof args.newTitle === "string" && args.newTitle.trim()
                ? args.newTitle.trim()
                : found.title,
            date: newDate,
            startTime: newStart,
            endTime: newEnd,
            notifyMinutes:
              typeof args.notifyMinutes === "number" ? args.notifyMinutes : found.notifyMinutes,
            color: "#a78bfa",
          },
        });
        results.push({ tool_call_id: id, summary: `Reserva "${found.title}" actualizada.` });
        break;
      }

      case "delete_reservation": {
        const onDate =
          typeof args.onDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(args.onDate)
            ? args.onDate
            : undefined;
        const pool = onDate ? ctx.reservations.filter((r) => r.date === onDate) : ctx.reservations;
        const found = findByName(pool, String(args.title ?? ""));
        if (!found) {
          results.push({ tool_call_id: id, summary: `No encontré la reserva "${args.title}".` });
          break;
        }
        actions.push({ type: "DELETE_RESERVATION", id: found.id });
        results.push({ tool_call_id: id, summary: `Reserva borrada: "${found.title}".` });
        break;
      }

      case "add_flex_routine": {
        const fname = String(args.name ?? "").trim();
        if (!fname) {
          results.push({ tool_call_id: id, summary: "Falta el nombre de la rutina flexible." });
          break;
        }
        actions.push({
          type: "ADD_FLEX_ROUTINE",
          flexRoutine: { id: uuid(), name: fname, color: randomColor(), completedDates: [] },
        });
        results.push({ tool_call_id: id, summary: `Rutina flexible creada: ${fname}.` });
        break;
      }

      case "complete_flex_routine": {
        const found = findByName(ctx.flexRoutines, String(args.name ?? ""));
        if (!found) {
          results.push({
            tool_call_id: id,
            summary: `No encontré una rutina flexible que diga "${args.name}".`,
          });
          break;
        }
        actions.push({ type: "TOGGLE_FLEX_ROUTINE", id: found.id, date: ctx.today });
        results.push({ tool_call_id: id, summary: `Marqué "${found.name}" como hecha hoy.` });
        break;
      }

      case "set_daily_note": {
        const text = String(args.text ?? "");
        const date =
          typeof args.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(args.date)
            ? args.date
            : ctx.today;
        actions.push({ type: "SET_NOTE", date, text });
        results.push({ tool_call_id: id, summary: "Nota del día guardada." });
        break;
      }

      case "update_settings": {
        const settings: Record<string, unknown> = {};
        if (typeof args.wakeTime === "string") settings.wakeTime = args.wakeTime;
        if (typeof args.notifications === "boolean") settings.notifications = args.notifications;
        if (typeof args.notifyMinutesBefore === "number")
          settings.notifyMinutesBefore = args.notifyMinutesBefore;
        if (typeof args.morningMotivation === "boolean")
          settings.morningMotivation = args.morningMotivation;
        if (Object.keys(settings).length === 0) {
          results.push({ tool_call_id: id, summary: "No se indicó qué configurar." });
          break;
        }
        actions.push({ type: "UPDATE_SETTINGS", settings });
        results.push({ tool_call_id: id, summary: "Configuración actualizada." });
        break;
      }

      default:
        results.push({ tool_call_id: id, summary: `Acción desconocida: ${name}.` });
    }
  }

  return { actions, results };
}
