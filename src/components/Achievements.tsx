"use client";

import type { DayLog } from "@/lib/types";
import { Flame, Target, Trophy, CalendarCheck, Zap, Crown, Lock } from "lucide-react";

interface Badge {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  unlocked: boolean;
  progress: number; // 0..1
}

function computeStreak(logs: DayLog[]): number {
  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
  let streak = 0;
  for (const log of sorted) {
    const t = log.routinesTotal + log.tasksTotal;
    const d = log.routinesCompleted + log.tasksCompleted;
    if (t > 0 && d / t >= 0.6) streak++;
    else break;
  }
  return streak;
}

export function Achievements({ logs }: { logs: DayLog[] }) {
  const streak = computeStreak(logs);
  const registered = logs.length;
  const perfectDays = logs.filter((l) => {
    const t = l.routinesTotal + l.tasksTotal;
    return t > 0 && l.routinesCompleted + l.tasksCompleted === t;
  }).length;
  const maxTasks = logs.reduce((m, l) => Math.max(m, l.tasksCompleted), 0);

  const badges: Badge[] = [
    {
      id: "streak3",
      icon: Flame,
      title: "En racha",
      desc: "3 días seguidos cumpliendo",
      unlocked: streak >= 3,
      progress: Math.min(streak / 3, 1),
    },
    {
      id: "streak7",
      icon: Zap,
      title: "Semana de fuego",
      desc: "7 días seguidos",
      unlocked: streak >= 7,
      progress: Math.min(streak / 7, 1),
    },
    {
      id: "perfect",
      icon: Target,
      title: "Día perfecto",
      desc: "100% de un día completado",
      unlocked: perfectDays >= 1,
      progress: perfectDays >= 1 ? 1 : 0,
    },
    {
      id: "consistent",
      icon: CalendarCheck,
      title: "Constante",
      desc: "10 días registrados",
      unlocked: registered >= 10,
      progress: Math.min(registered / 10, 1),
    },
    {
      id: "productive",
      icon: Trophy,
      title: "Productivo",
      desc: "5 tareas en un día",
      unlocked: maxTasks >= 5,
      progress: Math.min(maxTasks / 5, 1),
    },
    {
      id: "marathon",
      icon: Crown,
      title: "Maratonista",
      desc: "30 días registrados",
      unlocked: registered >= 30,
      progress: Math.min(registered / 30, 1),
    },
  ];

  const unlockedCount = badges.filter((b) => b.unlocked).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[12px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">Logros</h3>
        <span className="text-[11px] text-[var(--text-tertiary)] tabular-nums">{unlockedCount}/{badges.length}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {badges.map((b) => {
          const Icon = b.unlocked ? b.icon : Lock;
          return (
            <div
              key={b.id}
              className={`rounded-xl border p-3 transition ${
                b.unlocked
                  ? "border-[var(--accent)]/25 bg-[var(--accent-subtle)]"
                  : "border-[var(--border)] bg-white/[0.01]"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center mb-2 ${
                  b.unlocked ? "bg-[var(--accent)]/15" : "bg-white/[0.03]"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${b.unlocked ? "text-[var(--accent)]" : "text-[var(--text-tertiary)]"}`} />
              </div>
              <p className={`text-[12px] font-medium ${b.unlocked ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>
                {b.title}
              </p>
              <p className="text-[10px] text-[var(--text-tertiary)] leading-tight mt-0.5">{b.desc}</p>
              {!b.unlocked && b.progress > 0 && (
                <div className="mt-2 h-1 bg-white/[0.04] rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-[var(--accent)]/50" style={{ width: `${b.progress * 100}%` }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
