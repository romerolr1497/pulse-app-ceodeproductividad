"use client";

import { useStore } from "@/lib/store";

export function DayProgress() {
  const { state } = useStore();

  const routinesDone = state.routines.filter((r) => r.completed).length;
  const routinesTotal = state.routines.length;
  const tasksDone = state.tasks.filter((t) => t.completed).length;
  const tasksTotal = state.tasks.length;

  const allDone = routinesDone + tasksDone;
  const allTotal = routinesTotal + tasksTotal || 1;
  const pct = Math.round((allDone / allTotal) * 100);

  const circumference = 2 * Math.PI * 54;
  const strokeDasharray = `${(pct / 100) * circumference} ${circumference}`;

  return (
    <div className="glass-card p-5 lg:p-6 h-full flex flex-col justify-between relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute -top-20 -right-20 w-40 h-40 bg-[var(--accent)]/[0.04] rounded-full blur-3xl" />
      
      <div className="relative">
        <p className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-widest mb-4">
          Progreso
        </p>

        {/* Circular progress - centered */}
        <div className="flex items-center justify-center">
          <div className="relative w-28 h-28 lg:w-32 lg:h-32">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
              {/* Track */}
              <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="6" />
              {/* Progress */}
              <circle
                cx="60" cy="60" r="54" fill="none"
                stroke="var(--accent)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={strokeDasharray}
                className="transition-all duration-1000 ease-out"
                style={{ filter: "drop-shadow(0 0 6px var(--accent-glow))" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="stat-number text-3xl lg:text-4xl text-[var(--text-primary)]">{pct}</span>
              <span className="text-[10px] text-[var(--text-tertiary)] -mt-0.5">%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom stats */}
      <div className="relative flex items-center justify-between mt-4 pt-4 border-t border-[var(--border)]">
        <div className="text-center flex-1">
          <div className="flex items-baseline justify-center gap-0.5">
            <span className="stat-number text-lg text-[var(--text-primary)]">{routinesDone}</span>
            <span className="text-[11px] text-[var(--text-tertiary)]">/ {routinesTotal}</span>
          </div>
          <p className="text-[10px] text-[var(--text-tertiary)] mt-1 uppercase tracking-wider">rutinas</p>
        </div>
        <div className="w-px h-9 bg-[var(--border)]" />
        <div className="text-center flex-1">
          <div className="flex items-baseline justify-center gap-0.5">
            <span className="stat-number text-lg text-[var(--text-primary)]">{tasksDone}</span>
            <span className="text-[11px] text-[var(--text-tertiary)]">/ {tasksTotal || 0}</span>
          </div>
          <p className="text-[10px] text-[var(--text-tertiary)] mt-1 uppercase tracking-wider">tareas</p>
        </div>
      </div>
    </div>
  );
}
