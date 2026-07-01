"use client";

import { useStore } from "@/lib/store";
import { Flame, Target, Zap, TrendingUp } from "lucide-react";

export function QuickStats() {
  const { state } = useStore();

  const today = new Date().toISOString().split("T")[0];
  const sortedLogs = [...state.logs].sort((a, b) => b.date.localeCompare(a.date));
  let streak = 0;
  for (const log of sortedLogs) {
    const total = log.routinesTotal + log.tasksTotal;
    const done = log.routinesCompleted + log.tasksCompleted;
    if (total > 0 && done / total >= 0.6) streak++;
    else break;
  }

  const weekLogs = sortedLogs.slice(0, 7);
  const weekAvg = weekLogs.length > 0
    ? Math.round(weekLogs.reduce((sum, l) => {
        const total = l.routinesTotal + l.tasksTotal;
        return sum + (total > 0 ? (l.routinesCompleted + l.tasksCompleted) / total * 100 : 0);
      }, 0) / weekLogs.length)
    : 0;

  const todayDone = state.routines.filter(r => r.completed).length + state.tasks.filter(t => t.completed).length;
  const todayTotal = state.routines.length + state.tasks.length;

  const stats = [
    {
      icon: Flame,
      label: "Racha",
      value: streak,
      unit: "días",
      accent: "#f97316",
    },
    {
      icon: TrendingUp,
      label: "Semana",
      value: weekAvg,
      unit: "%",
      accent: "var(--success)",
    },
    {
      icon: Zap,
      label: "Completado",
      value: todayDone,
      unit: `/ ${todayTotal}`,
      accent: "var(--accent)",
    },
  ];

  return (
    <div className="glass-card p-5 lg:p-6 h-full">
      <p className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-widest mb-4">
        Métricas
      </p>
      <div className="grid grid-cols-3 gap-3 h-[calc(100%-2rem)]">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="relative flex flex-col items-center justify-center rounded-xl bg-white/[0.02] border border-[var(--border)] p-3 lg:p-4 overflow-hidden"
          >
            {/* subtle accent glow top */}
            <div
              className="absolute -top-8 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full blur-2xl opacity-20"
              style={{ backgroundColor: stat.accent }}
            />
            <div
              className="relative w-9 h-9 rounded-xl flex items-center justify-center mb-3 ring-1"
              style={{ backgroundColor: `${stat.accent}14`, boxShadow: `inset 0 0 0 1px ${stat.accent}20` }}
            >
              <stat.icon className="w-4 h-4" style={{ color: stat.accent }} />
            </div>
            <span className="relative stat-number text-2xl lg:text-[28px] text-[var(--text-primary)] leading-none">{stat.value}</span>
            <span className="relative text-[10px] text-[var(--text-tertiary)] mt-1.5">{stat.unit}</span>
            <p className="relative text-[10px] font-medium text-[var(--text-secondary)] mt-1">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
