"use client";

import { useEffect, useRef, useState } from "react";
import { useStore, localDateStr } from "@/lib/store";
import { NotebookPen, Check } from "lucide-react";

export function DailyNote() {
  const { state, dispatch } = useStore();
  const [mounted, setMounted] = useState(false);
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);
  const today = localDateStr();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
    setText(state.notes[today] || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onChange(value: string) {
    setText(value);
    setSaved(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      dispatch({ type: "SET_NOTE", date: today, text: value });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }, 600);
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <NotebookPen className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
          <h2 className="text-[13px] font-semibold text-[var(--text-secondary)] font-heading tracking-tight">
            Nota del día
          </h2>
        </div>
        {saved && (
          <span className="flex items-center gap-1 text-[10px] text-[var(--success)]">
            <Check className="w-3 h-3" /> Guardado
          </span>
        )}
      </div>
      <textarea
        value={mounted ? text : ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="¿Qué salió bien hoy? ¿Qué mejorar mañana?"
        rows={3}
        className="w-full bg-transparent resize-none px-5 py-3 text-[13px] leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"
      />
    </div>
  );
}
