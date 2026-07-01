"use client";

import { useStore } from "@/lib/store";

export function ProgressBar() {
  const { state } = useStore();

  const routinesDone = state.routines.filter((r) => r.completed).length;
  const routinesTotal = state.routines.length;
  const tasksDone = state.tasks.filter((t) => t.completed).length;
  const tasksTotal = state.tasks.length;

  const allDone = routinesDone + tasksDone;
  const allTotal = routinesTotal + tasksTotal;
  const pct = allTotal > 0 ? Math.round((allDone / allTotal) * 100) : 0;

  return (
    <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
          Progreso del día
        </h2>
        <span className="text-2xl font-bold text-indigo-400">{pct}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-2.5 bg-zinc-800 rounded-full overflow-hidden mb-3">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${pct}%`,
            background: pct >= 80 ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#6366f1",
          }}
        />
      </div>

      {/* Stats row */}
      <div className="flex gap-4 text-xs text-zinc-500">
        <span>
          <span className="text-zinc-300 font-medium">{routinesDone}/{routinesTotal}</span> rutinas
        </span>
        <span>
          <span className="text-zinc-300 font-medium">{tasksDone}/{tasksTotal}</span> tareas
        </span>
      </div>

      {/* Weekly mini chart */}
      <WeekDots />
    </div>
  );
}

function WeekDots() {
  const { state } = useStore();
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split("T")[0];
  });

  const dayNames = ["D", "L", "M", "X", "J", "V", "S"];

  return (
    <div className="flex justify-between mt-4 px-1">
      {days.map((date) => {
        const log = state.logs.find((l) => l.date === date);
        const d = new Date(date + "T12:00:00");
        const isToday = date === today.toISOString().split("T")[0];
        const pct = log ? Math.round(((log.routinesCompleted + log.tasksCompleted) / (log.routinesTotal + log.tasksTotal)) * 100) : 0;
        const color = !log ? "bg-zinc-800" : pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500";

        return (
          <div key={date} className="flex flex-col items-center gap-1">
            <span className={`text-[10px] ${isToday ? "text-indigo-400 font-bold" : "text-zinc-600"}`}>
              {dayNames[d.getDay()]}
            </span>
            <div className={`w-4 h-4 rounded-full ${color} ${isToday ? "ring-2 ring-indigo-500/50" : ""}`} />
          </div>
        );
      })}
    </div>
  );
}
