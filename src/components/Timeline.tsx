"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { Check } from "lucide-react";
import { fireConfetti } from "@/lib/confetti";

export function Timeline() {
  const { state, dispatch } = useStore();
  // null until mounted on the client, so SSR and first client render match
  const [currentMinutes, setCurrentMinutes] = useState<number | null>(null);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentMinutes(now.getHours() * 60 + now.getMinutes());
    };
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, []);

  function timeToMinutes(time: string) {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  }

  function getStatus(routine: typeof state.routines[0]) {
    if (routine.completed) return "completed";
    if (currentMinutes === null) return "upcoming";
    const start = timeToMinutes(routine.startTime);
    const end = timeToMinutes(routine.endTime);
    if (currentMinutes >= start && currentMinutes < end) return "active";
    if (currentMinutes >= end) return "missed";
    return "upcoming";
  }

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="px-5 lg:px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
        <h2 className="text-[13px] font-semibold text-[var(--text-secondary)] font-heading tracking-tight">Rutina</h2>
        <span className="text-[11px] text-[var(--text-tertiary)] tabular-nums">
          {state.routines.filter(r => r.completed).length} / {state.routines.length}
        </span>
      </div>

      {/* Timeline items */}
      <div className="divide-y divide-[var(--border)]">
        {state.routines.map((routine) => {
          const status = getStatus(routine);

          return (
            <button
              key={routine.id}
              onClick={(e) => {
                if (!routine.completed) fireConfetti(e.clientX, e.clientY);
                dispatch({ type: "TOGGLE_ROUTINE", id: routine.id });
              }}
              className={`w-full flex items-center gap-4 px-5 lg:px-6 py-3 text-left transition-all duration-200 hover:bg-white/[0.02] ${
                status === "active" ? "bg-[var(--accent-subtle)]" : ""
              }`}
            >
              {/* Time */}
              <span className={`w-11 text-[12px] font-mono tabular-nums shrink-0 ${
                status === "active" ? "text-[var(--accent)] font-semibold" : "text-[var(--text-tertiary)]"
              }`}>
                {routine.startTime}
              </span>

              {/* Status dot */}
              <div className={`w-2.5 h-2.5 rounded-full shrink-0 transition-all ${
                status === "completed"
                  ? "bg-[var(--success)]"
                  : status === "active"
                  ? "bg-[var(--accent)] shadow-[0_0_8px_var(--accent-glow)] pulse-dot"
                  : status === "missed"
                  ? "bg-[var(--text-tertiary)]/50"
                  : "bg-transparent border border-[var(--text-tertiary)]/40"
              }`} />

              {/* Name */}
              <span className={`flex-1 text-[13px] truncate ${
                status === "completed"
                  ? "text-[var(--text-tertiary)] line-through"
                  : status === "active"
                  ? "text-[var(--text-primary)] font-medium"
                  : status === "missed"
                  ? "text-[var(--text-tertiary)]"
                  : "text-[var(--text-secondary)]"
              }`}>
                {routine.name}
              </span>

              {/* Badge / Duration */}
              {status === "active" ? (
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent)] bg-[var(--accent-subtle)] px-2 py-0.5 rounded-md">
                  now
                </span>
              ) : status === "completed" ? (
                <Check className="w-3.5 h-3.5 text-[var(--success)]" strokeWidth={2.5} />
              ) : (
                <span className="text-[11px] text-[var(--text-tertiary)] tabular-nums">
                  {timeToMinutes(routine.endTime) - timeToMinutes(routine.startTime)}m
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
