"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export function LiveHeader() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) {
    // Avoid hydration mismatch — render a stable placeholder height
    return <header className="mb-5 lg:mb-6 h-[60px]" />;
  }

  const hour = now.getHours();
  const greeting =
    hour < 6 ? "Madrugada" : hour < 12 ? "Mañana" : hour < 19 ? "Tarde" : "Noche";

  const hh = format(now, "HH");
  const mm = format(now, "mm");
  const ss = format(now, "ss");

  return (
    <header className="mb-5 lg:mb-6 flex items-end justify-between">
      {/* Left: date */}
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] pulse-dot" />
          <p className="text-[11px] text-[var(--text-tertiary)] uppercase tracking-[0.2em] font-medium">
            {greeting} · {format(now, "EEEE", { locale: es })}
          </p>
        </div>
        <h1 className="font-heading text-2xl lg:text-[28px] font-bold text-[var(--text-primary)] tracking-tight leading-none">
          {format(now, "d")}{" "}
          <span className="text-[var(--text-secondary)] font-medium">
            {format(now, "MMMM", { locale: es })}
          </span>
        </h1>
      </div>

      {/* Right: live clock */}
      <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.02] border border-[var(--border)]">
        <span className="stat-number text-lg lg:text-xl text-[var(--text-primary)] tabular-nums leading-none">
          {hh}
        </span>
        <span className="text-[var(--accent)] font-bold leading-none animate-pulse">:</span>
        <span className="stat-number text-lg lg:text-xl text-[var(--text-primary)] tabular-nums leading-none">
          {mm}
        </span>
        <span className="stat-number text-[11px] text-[var(--text-tertiary)] tabular-nums leading-none ml-0.5 self-end mb-0.5">
          {ss}
        </span>
      </div>
    </header>
  );
}
