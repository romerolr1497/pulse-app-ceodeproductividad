"use client";

import { useEffect, useState } from "react";
import type { DayLog } from "@/lib/types";

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function colorFor(pct: number | null): string {
  if (pct === null) return "rgba(255,255,255,0.03)";
  if (pct === 0) return "rgba(255,255,255,0.05)";
  if (pct < 40) return "rgba(229,160,30,0.25)";
  if (pct < 70) return "rgba(229,160,30,0.5)";
  if (pct < 90) return "rgba(229,160,30,0.75)";
  return "#e5a01e";
}

const WEEKS = 14; // ~98 días

export function Heatmap({ logs }: { logs: DayLog[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="h-[160px]" />;
  }

  const logMap = new Map(logs.map((l) => [l.date, l]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const total = WEEKS * 7;
  const days: { date: string; pct: number | null; label: string }[] = [];
  for (let i = total - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const ds = localDateStr(d);
    const log = logMap.get(ds);
    let pct: number | null = null;
    if (log) {
      const t = log.routinesTotal + log.tasksTotal;
      pct = t > 0 ? Math.round(((log.routinesCompleted + log.tasksCompleted) / t) * 100) : 0;
    }
    days.push({ date: ds, pct, label: d.toLocaleDateString("es-AR", { day: "numeric", month: "short" }) });
  }

  // Celdas vacías iniciales para alinear por día de semana (0 = domingo)
  const firstDow = new Date(days[0].date + "T00:00:00").getDay();
  const cells: ({ date: string; pct: number | null; label: string } | null)[] = [
    ...Array(firstDow).fill(null),
    ...days,
  ];

  const activeDays = days.filter((d) => d.pct !== null).length;

  return (
    <div>
      <div
        className="grid grid-rows-7 grid-flow-col gap-[3px] w-full"
        style={{ gridAutoColumns: "1fr" }}
      >
        {cells.map((cell, i) =>
          cell ? (
            <div
              key={cell.date}
              title={`${cell.label}: ${cell.pct === null ? "sin datos" : cell.pct + "%"}`}
              className="aspect-square rounded-[3px] transition-transform hover:scale-125"
              style={{ backgroundColor: colorFor(cell.pct) }}
            />
          ) : (
            <div key={`empty-${i}`} className="aspect-square" />
          )
        )}
      </div>
      <div className="flex items-center justify-between mt-3">
        <span className="text-[10px] text-[var(--text-tertiary)]">{activeDays} días registrados</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[var(--text-tertiary)]">Menos</span>
          {[5, 30, 55, 80, 100].map((p) => (
            <div key={p} className="w-2.5 h-2.5 rounded-[2px]" style={{ backgroundColor: colorFor(p) }} />
          ))}
          <span className="text-[10px] text-[var(--text-tertiary)]">Más</span>
        </div>
      </div>
    </div>
  );
}
