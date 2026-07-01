"use client";

import { useState, useRef, useEffect } from "react";
import { useStore } from "@/lib/store";
import { parseCommand } from "@/lib/parseCommand";
import type { Task } from "@/lib/types";
import { Mic, Send, Activity } from "lucide-react";

interface Msg {
  id: string;
  role: "user" | "bot";
  text: string;
}

// Tipado mínimo para la Web Speech API (no está en los tipos estándar)
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: (e: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void;
  onend: () => void;
  onerror: () => void;
  start: () => void;
  stop: () => void;
}

function newTask(title: string): Task {
  return {
    id: crypto.randomUUID(),
    title,
    completed: false,
    priority: 2,
    createdAt: new Date().toISOString(),
  };
}

export function AssistantChat() {
  const { state, dispatch } = useStore();
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [listening, setListening] = useState(false);
  const [speechOk, setSpeechOk] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    setSpeechOk(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  function handleSend(textArg?: string) {
    const text = (textArg ?? input).trim();
    if (!text) return;

    const parsed = parseCommand(text, state.projects);

    if (parsed.kind === "task" && parsed.title) {
      dispatch({ type: "ADD_TASK", task: newTask(parsed.title) });
    } else if (parsed.kind === "project-task" && parsed.title && parsed.projectId) {
      dispatch({
        type: "ADD_PROJECT_TASK",
        projectId: parsed.projectId,
        task: newTask(parsed.title),
      });
    }

    setMsgs((m) => [
      ...m,
      { id: crypto.randomUUID(), role: "user", text },
      { id: crypto.randomUUID(), role: "bot", text: parsed.reply },
    ]);
    setInput("");
  }

  function toggleMic() {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return;

    if (listening) {
      recRef.current?.stop();
      return;
    }

    const rec = new SR();
    rec.lang = "es-AR";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setInput(transcript);
      handleSend(transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  return (
    <div className="glass-card p-4 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <Activity size={16} className="text-[var(--accent)]" />
        <h2 className="font-heading text-sm font-semibold text-[var(--text-primary)]">
          Beat
        </h2>
        <span className="text-[11px] text-[var(--text-tertiary)] ml-auto">
          el asistente de Pulse
        </span>
      </div>

      {/* Historial */}
      <div
        ref={scrollRef}
        className="flex flex-col gap-2 max-h-40 overflow-y-auto mb-3 pr-1"
      >
        {msgs.length === 0 ? (
          <div className="text-[12px] text-[var(--text-tertiary)] leading-relaxed">
            Hola, soy <span className="text-[var(--accent)]">Beat</span>. Decime qué querés agendar.
          </div>
        ) : (
          msgs.map((m) => (
            <div
              key={m.id}
              className={`text-[12px] px-3 py-2 rounded-xl max-w-[85%] ${
                m.role === "user"
                  ? "self-end bg-[var(--accent-subtle)] text-[var(--text-primary)]"
                  : "self-start bg-[rgba(255,255,255,0.04)] text-[var(--text-secondary)]"
              }`}
            >
              {m.text}
            </div>
          ))
        )}
      </div>

      {/* Entrada */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex items-center gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={listening ? "Escuchando…" : "Escribí una tarea…"}
          className="flex-1 bg-[rgba(255,255,255,0.04)] border border-[var(--border)] rounded-xl px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-muted)]"
        />
        {speechOk && (
          <button
            type="button"
            onClick={toggleMic}
            aria-label="Dictar por voz"
            className={`shrink-0 w-9 h-9 flex items-center justify-center rounded-xl transition-colors ${
              listening
                ? "bg-[var(--danger)] text-white animate-pulse"
                : "bg-[rgba(255,255,255,0.04)] text-[var(--text-secondary)] hover:text-[var(--accent)]"
            }`}
          >
            <Mic size={16} />
          </button>
        )}
        <button
          type="submit"
          aria-label="Enviar"
          className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-[var(--accent)] text-black hover:bg-[var(--accent-muted)] transition-colors"
        >
          <Send size={16} />
        </button>
      </form>

      {!speechOk && (
        <p className="text-[11px] text-[var(--text-tertiary)] mt-2">
          Para dictar: tocá el campo y usá el 🎤 del teclado de tu celular.
        </p>
      )}
    </div>
  );
}
