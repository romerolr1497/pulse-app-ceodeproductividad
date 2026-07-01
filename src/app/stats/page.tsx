"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { TrendingUp, Calendar, Flame, Award } from "lucide-react";
import { PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { Heatmap } from "@/components/Heatmap";
import { Achievements } from "@/components/Achievements";

export default function StatsPage() {
  const { state } = useStore();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const today = new Date();
  const last14Days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (13 - i));
    const dateStr = d.toISOString().split("T")[0];
    const log = state.logs.find((l) => l.date === dateStr);
    const dayName = d.toLocaleDateString("es-AR", { weekday: "short" });
    if (log) {
      const total = log.routinesTotal + log.tasksTotal;
      return {
        date: dayName,
        fullDate: dateStr,
        completion: total > 0 ? Math.round(((log.routinesCompleted + log.tasksCompleted) / total) * 100) : 0,
        routines: log.routinesCompleted,
        tasks: log.tasksCompleted,
      };
    }
    return { date: dayName, fullDate: dateStr, completion: 0, routines: 0, tasks: 0 };
  });

  const routinesDone = state.routines.filter((r) => r.completed).length;
  const routinesTotal = state.routines.length;
  const tasksDone = state.tasks.filter((t) => t.completed).length;
  const tasksTotal = state.tasks.length;
  const todayPct = (routinesTotal + tasksTotal) > 0
    ? Math.round(((routinesDone + tasksDone) / (routinesTotal + tasksTotal)) * 100)
    : 0;

  const pieData = [
    { name: "Completado", value: routinesDone + tasksDone, color: "#e5a01e" },
    { name: "Pendiente", value: (routinesTotal + tasksTotal) - (routinesDone + tasksDone), color: "rgba(255,255,255,0.04)" },
  ];

  const categoryData = [
    { name: "Rutinas", done: routinesDone, total: routinesTotal, color: "#34d399" },
    { name: "Tareas", done: tasksDone, total: tasksTotal || 1, color: "#e5a01e" },
  ];

  const sortedLogs = [...state.logs].sort((a, b) => b.date.localeCompare(a.date));
  let streak = 0;
  for (const log of sortedLogs) {
    const total = log.routinesTotal + log.tasksTotal;
    const done = log.routinesCompleted + log.tasksCompleted;
    if (total > 0 && done / total >= 0.6) streak++;
    else break;
  }

  const weekLogs = last14Days.slice(-7);
  const weekAvg = Math.round(weekLogs.reduce((s, d) => s + d.completion, 0) / 7);
  const bestDay = [...last14Days].sort((a, b) => b.completion - a.completion)[0];

  if (!mounted) {
    return <div className="p-4 lg:p-6 xl:p-8 max-w-[1400px] mx-auto min-h-[60vh]" />;
  }

  return (
    <div className="p-4 lg:p-6 xl:p-8 max-w-[1400px] mx-auto">
      <header className="mb-5 lg:mb-6">
        <p className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-widest">Analytics</p>
        <h1 className="font-heading text-xl lg:text-2xl font-bold text-[var(--text-primary)] tracking-tight mt-0.5">
          Estadísticas
        </h1>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KPICard label="Hoy" value={`${todayPct}%`} icon={TrendingUp} accent="#e5a01e" />
        <KPICard label="Promedio semanal" value={`${weekAvg}%`} icon={Calendar} accent="#34d399" />
        <KPICard label="Racha" value={`${streak}d`} icon={Flame} accent="#f97316" />
        <KPICard label="Mejor día" value={bestDay?.date || "-"} subtitle={`${bestDay?.completion || 0}%`} icon={Award} accent="#a78bfa" />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
        {/* Area Chart */}
        <div className="glass-card p-5 lg:p-6">
          <h3 className="text-[12px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-4">
            Últimos 14 días
          </h3>
          <div className="h-48 lg:h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={last14Days}>
                <defs>
                  <linearGradient id="colorCompletion" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e5a01e" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#e5a01e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#52525b", fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#52525b", fontSize: 10 }} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#16161c", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", fontSize: "11px" }}
                  labelStyle={{ color: "#8b8b94" }}
                />
                <Area type="monotone" dataKey="completion" stroke="#e5a01e" strokeWidth={2} fill="url(#colorCompletion)" name="%" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart */}
        <div className="glass-card p-5 lg:p-6">
          <h3 className="text-[12px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-4">
            Desglose de hoy
          </h3>
          <div className="flex items-center justify-center gap-8">
            <div className="w-32 h-32 lg:w-40 lg:h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%" cy="50%"
                    innerRadius="68%"
                    outerRadius="90%"
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-4">
              {categoryData.map((cat) => (
                <div key={cat.name}>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span className="text-[11px] text-[var(--text-tertiary)]">{cat.name}</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="stat-number text-lg text-[var(--text-primary)]">{cat.done}</span>
                    <span className="text-[10px] text-[var(--text-tertiary)]">/ {cat.total}</span>
                  </div>
                  <div className="w-20 h-1 bg-white/[0.04] rounded-full mt-1.5">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(cat.done / cat.total) * 100}%`, backgroundColor: cat.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bar Chart */}
        <div className="glass-card p-5 lg:p-6 lg:col-span-2">
          <h3 className="text-[12px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-4">
            Rutinas vs Tareas — última semana
          </h3>
          <div className="h-44 lg:h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekLogs} barGap={4}>
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#52525b", fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#52525b", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#16161c", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", fontSize: "11px" }}
                  labelStyle={{ color: "#8b8b94" }}
                />
                <Bar dataKey="routines" fill="#34d399" radius={[3, 3, 0, 0]} name="Rutinas" />
                <Bar dataKey="tasks" fill="#e5a01e" radius={[3, 3, 0, 0]} name="Tareas" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Heatmap de consistencia */}
        <div className="glass-card p-5 lg:p-6 lg:col-span-2">
          <h3 className="text-[12px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-4">
            Consistencia — últimas 14 semanas
          </h3>
          <Heatmap logs={state.logs} />
        </div>

        {/* Logros */}
        <div className="glass-card p-5 lg:p-6 lg:col-span-2">
          <Achievements logs={state.logs} />
        </div>
      </div>
    </div>
  );
}

function KPICard({ label, value, subtitle, icon: Icon, accent }: {
  label: string; value: string; subtitle?: string; icon: any; accent: string;
}) {
  return (
    <div className="glass-card p-4 lg:p-5">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: `${accent}12` }}>
        <Icon className="w-3.5 h-3.5" style={{ color: accent }} />
      </div>
      <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-0.5">{label}</p>
      <p className="stat-number text-xl lg:text-2xl text-[var(--text-primary)]">{value}</p>
      {subtitle && <p className="text-[11px] text-[var(--text-tertiary)]">{subtitle}</p>}
    </div>
  );
}
