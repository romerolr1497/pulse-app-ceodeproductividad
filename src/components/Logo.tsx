"use client";

export function Logo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      {/* Logomark - pulse wave inside a rounded square */}
      <div className="relative w-8 h-8 shrink-0">
        {/* Glow behind */}
        <div className="absolute inset-0 rounded-[10px] bg-[var(--accent)] blur-md opacity-30" />
        {/* Mark */}
        <div className="relative w-full h-full rounded-[10px] bg-gradient-to-br from-[var(--accent)] to-[#c47e0a] flex items-center justify-center overflow-hidden ring-1 ring-white/10">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-black/85">
            <path
              d="M2 12h3.5l2-6 3 13 2.5-9 1.8 4H22"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {/* Wordmark */}
      {!collapsed && (
        <div className="leading-none">
          <h1 className="font-heading font-bold text-[16px] tracking-[-0.02em] bg-gradient-to-r from-[var(--text-primary)] to-[var(--text-secondary)] bg-clip-text text-transparent">
            Pulse
          </h1>
          <p className="text-[9px] text-[var(--text-tertiary)] tracking-[0.18em] uppercase mt-1">
            CEO de productividad
          </p>
        </div>
      )}
    </div>
  );
}
