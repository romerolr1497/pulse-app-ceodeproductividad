"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useStore, localDateStr } from "@/lib/store";
import { parseCommand } from "@/lib/parseCommand";
import type { BeatAction, BeatContext } from "@/lib/beat/tools";
import { Mic, Send, Sparkles, Loader2 } from "lucide-react";

interface Msg {
  id: string;
  role: "user" | "bot";
  text: string;
}

// Tipos de acción que Beat puede ejecutar en el store (lista blanca de seguridad)
const ALLOWED_ACTIONS = new Set<BeatAction["type"]>([
  "ADD_TASK",
  "TOGGLE_TASK",
  "DELETE_TASK",
  "ADD_PROJECT",
  "DELETE_PROJECT",
  "ADD_PROJECT_TASK",
  "TOGGLE_PROJECT_TASK",
  "DELETE_PROJECT_TASK",
  "ADD_ROUTINE",
  "UPDATE_ROUTINE",
  "DELETE_ROUTINE",
  "TOGGLE_ROUTINE",
  "ADD_EVENT",
  "UPDATE_EVENT",
  "DELETE_EVENT",
  "ADD_RESERVATION",
  "UPDATE_RESERVATION",
  "DELETE_RESERVATION",
  "ADD_FLEX_ROUTINE",
  "TOGGLE_FLEX_ROUTINE",
  "SET_NOTE",
  "UPDATE_SETTINGS",
]);

// Tipado mínimo para la Web Speech API (no está en los tipos estándar)
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: (e: { results: { length: number; [i: number]: { [j: number]: { transcript: string } } } }) => void;
  onend: () => void;
  onerror: () => void;
  start: () => void;
  stop: () => void;
}

const SUGGESTIONS = [
  "Agregá una tarea: llamar al contador",
  "Agendá turno dentista el jueves a las 10",
  "Reservá de 15 a 17 para el proyecto",
  "Ya hice deporte",
];

export function Beat() {
  const { state, dispatch } = useStore();
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [listening, setListening] = useState(false);
  const [speechOk, setSpeechOk] = useState(false);
  const [loading, setLoading] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    setSpeechOk(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, loading]);

  const buildContext = useCallback((): BeatContext => {
    const s = stateRef.current;
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const dayNames = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
    const today = localDateStr();
    const pendingLoose = s.tasks
      .filter((t) => !t.completed)
      .map((t) => ({ id: t.id, title: t.title }));
    const pendingProject = s.projects.flatMap((p) =>
      p.tasks
        .filter((t) => !t.completed)
        .map((t) => ({ id: t.id, title: t.title, projectId: p.id }))
    );
    // Solo eventos de hoy en adelante para no inflar el contexto
    const upcomingEvents = s.events
      .filter((e) => e.date >= today)
      .slice(0, 40)
      .map((e) => ({
        id: e.id,
        title: e.title,
        date: e.date,
        time: e.time,
        notes: e.notes,
        notifyMinutes: e.notifyMinutes,
      }));
    const upcomingReservations = s.reservations
      .filter((r) => r.repeat === "daily" || r.date >= today)
      .slice(0, 40)
      .map((r) => ({
        id: r.id,
        title: r.title,
        date: r.date,
        startTime: r.startTime,
        endTime: r.endTime,
        notifyMinutes: r.notifyMinutes,
        repeat: r.repeat,
      }));
    return {
      today,
      now: `${hh}:${mm}`,
      weekday: dayNames[now.getDay()],
      projects: s.projects.map((p) => ({ id: p.id, name: p.name })),
      routines: s.routines.map((r) => ({
        id: r.id,
        name: r.name,
        startTime: r.startTime,
        endTime: r.endTime,
        days: r.days,
      })),
      pendingTasks: [...pendingLoose, ...pendingProject],
      events: upcomingEvents,
      reservations: upcomingReservations,
      flexRoutines: s.flexRoutines.map((f) => ({ id: f.id, name: f.name })),
    };
  }, []);

  // Fallback local (sin OpenAI): usa el parser de comandos por regex
  const runFallback = useCallback(
    (text: string) => {
      const parsed = parseCommand(text, stateRef.current.projects);
      if (parsed.kind === "task" && parsed.title) {
        dispatch({
          type: "ADD_TASK",
          task: {
            id: crypto.randomUUID(),
            title: parsed.title,
            completed: false,
            priority: 2,
            createdAt: new Date().toISOString(),
          },
        });
      } else if (parsed.kind === "project-task" && parsed.title && parsed.projectId) {
        dispatch({
          type: "ADD_PROJECT_TASK",
          projectId: parsed.projectId,
          task: {
            id: crypto.randomUUID(),
            title: parsed.title,
            completed: false,
            priority: 2,
            createdAt: new Date().toISOString(),
            project: parsed.projectId,
          },
        });
      }
      return parsed.reply;
    },
    [dispatch]
  );

  const send = useCallback(
    async (textArg?: string) => {
      const text = (textArg ?? input).trim();
      if (!text || loading) return;

      setMsgs((m) => [...m, { id: crypto.randomUUID(), role: "user", text }]);
      setInput("");
      setLoading(true);

      const history = msgs.slice(-8).map((m) => ({
        role: (m.role === "bot" ? "assistant" : "user") as "assistant" | "user",
        content: m.text,
      }));

      try {
        const res = await fetch("/api/beat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, context: buildContext(), history }),
        });

        if (!res.ok) {
          // Servidor sin clave o error: caemos al parser local
          const reply = runFallback(text);
          setMsgs((m) => [...m, { id: crypto.randomUUID(), role: "bot", text: reply }]);
          return;
        }

        const data = (await res.json()) as { reply?: string; actions?: BeatAction[] };
        const actions = Array.isArray(data.actions) ? data.actions : [];

        for (const action of actions) {
          if (action && ALLOWED_ACTIONS.has(action.type)) {
            (dispatch as unknown as (a: BeatAction) => void)(action);
          }
        }

        const reply = data.reply?.trim() || "Listo.";
        setMsgs((m) => [...m, { id: crypto.randomUUID(), role: "bot", text: reply }]);
      } catch {
        const reply = runFallback(text);
        setMsgs((m) => [...m, { id: crypto.randomUUID(), role: "bot", text: reply }]);
      } finally {
        setLoading(false);
      }
    },
    [input, loading, msgs, buildContext, runFallback, dispatch]
  );

  // Micrófono estilo WhatsApp/Telegram: mantené apretado para grabar y soltá
  // para enviar. startRec arranca la escucha; stopRec la corta y al terminar
  // (onend) manda automáticamente lo que se reconoció.
  function startRec() {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR || listening || loading) return;

    const rec = new SR();
    rec.lang = "es-AR";
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    finalRef.current = "";
    rec.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
      }
      finalRef.current = text;
      setInput(text);
    };
    rec.onend = () => {
      setListening(false);
      const text = finalRef.current.trim();
      if (text) void send(text);
    };
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }

  function stopRec() {
    recRef.current?.stop();
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-8rem)] lg:h-[calc(100dvh-3rem)] max-w-2xl mx-auto">
      {/* Encabezado */}
      <div className="flex items-center gap-2.5 mb-4 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-[var(--accent-subtle)] flex items-center justify-center">
          <Sparkles size={18} className="text-[var(--accent)]" />
        </div>
        <div>
          <h1 className="font-heading text-lg font-semibold text-[var(--text-primary)] leading-tight">
            Beat
          </h1>
          <p className="text-[11px] text-[var(--text-tertiary)]">
            tu asistente de Pulse
          </p>
        </div>
      </div>

      {/* Historial */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto flex flex-col gap-2.5 pr-1">
        {msgs.length === 0 ? (
          <div className="flex flex-col gap-4 my-auto">
            <p className="text-[14px] text-[var(--text-secondary)] leading-relaxed text-center">
              Hola, soy <span className="text-[var(--accent)]">Beat</span>.<br />
              Decime en tus palabras qué querés hacer y lo armo en la app.
            </p>
            <div className="flex flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-left text-[12.5px] px-3.5 py-2.5 rounded-xl bg-[rgba(255,255,255,0.03)] border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          msgs.map((m) => (
            <div
              key={m.id}
              className={`text-[13px] px-3.5 py-2.5 rounded-2xl max-w-[85%] leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "self-end bg-[var(--accent-subtle)] text-[var(--text-primary)]"
                  : "self-start bg-[rgba(255,255,255,0.04)] text-[var(--text-secondary)]"
              }`}
            >
              {m.text}
            </div>
          ))
        )}
        {loading && (
          <div className="self-start flex items-center gap-2 text-[12px] text-[var(--text-tertiary)] px-3.5 py-2.5">
            <Loader2 size={14} className="animate-spin" />
            Beat está pensando…
          </div>
        )}
      </div>

      {/* Entrada */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="flex items-center gap-2 mt-3 shrink-0"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={listening ? "Escuchando…" : "Escribile a Beat…"}
          disabled={loading}
          className="flex-1 bg-[rgba(255,255,255,0.04)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-muted)] disabled:opacity-60"
        />
        {speechOk && (
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              try {
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              } catch {}
              startRec();
            }}
            onPointerUp={(e) => {
              e.preventDefault();
              stopRec();
            }}
            onPointerCancel={() => stopRec()}
            onContextMenu={(e) => e.preventDefault()}
            aria-label="Mantené apretado para dictar y soltá para enviar"
            className={`shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-transform select-none touch-none ${
              listening
                ? "bg-[var(--danger)] text-white animate-pulse scale-110"
                : "bg-[rgba(255,255,255,0.04)] text-[var(--text-secondary)] hover:text-[var(--accent)]"
            }`}
          >
            <Mic size={17} />
          </button>
        )}
        <button
          type="submit"
          aria-label="Enviar"
          disabled={loading}
          className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-[var(--accent)] text-black hover:bg-[var(--accent-muted)] transition-colors disabled:opacity-60"
        >
          <Send size={17} />
        </button>
      </form>

      {speechOk ? (
        <p className="text-[11px] text-[var(--text-tertiary)] mt-2 shrink-0 text-center">
          Mantené apretado el 🎤 y soltá para enviar.
        </p>
      ) : (
        <p className="text-[11px] text-[var(--text-tertiary)] mt-2 shrink-0">
          Para dictar: tocá el campo y usá el 🎤 del teclado de tu celular.
        </p>
      )}
    </div>
  );
}
