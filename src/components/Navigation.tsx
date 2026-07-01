"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FolderKanban, BarChart3, Settings, ChevronUp } from "lucide-react";
import { Logo } from "./Logo";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Hoy" },
  { href: "/projects", icon: FolderKanban, label: "Proyectos" },
  { href: "/stats", icon: BarChart3, label: "Stats" },
  { href: "/settings", icon: Settings, label: "Config" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-[72px] xl:w-60 bg-[var(--surface)]/60 backdrop-blur-2xl border-r border-[var(--border)] flex-col z-50 transition-all">
      {/* Logo */}
      <div className="px-3 xl:px-5 py-5 flex items-center justify-center xl:justify-start border-b border-[var(--border)]">
        <div className="hidden xl:block">
          <Logo />
        </div>
        <div className="xl:hidden">
          <Logo collapsed />
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 xl:px-3 py-2 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-center xl:justify-start gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                isActive
                  ? "bg-[var(--accent-subtle)] text-[var(--accent)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/[0.03]"
              }`}
            >
              <item.icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? "text-[var(--accent)]" : ""}`} />
              <span className="hidden xl:inline">{item.label}</span>
              {isActive && <div className="hidden xl:block ml-auto w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-2 xl:px-3 py-3 border-t border-[var(--border)]">
        <button className="w-full flex items-center justify-center xl:justify-start gap-3 px-2 py-2 rounded-xl hover:bg-white/[0.03] transition-colors group">
          <div className="relative shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2a2a32] to-[#16161c] border border-white/10 flex items-center justify-center">
              <span className="font-heading font-bold text-[12px] bg-gradient-to-br from-[var(--accent)] to-[#c47e0a] bg-clip-text text-transparent">
                LR
              </span>
            </div>
            {/* online status dot */}
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[var(--success)] border-2 border-[var(--surface)]" />
          </div>
          <div className="hidden xl:flex flex-col items-start leading-tight">
            <p className="text-[13px] font-medium text-[var(--text-primary)]">Lorenzo Romero</p>
            <p className="text-[10px] text-[var(--text-tertiary)]">En foco · activo</p>
          </div>
          <ChevronUp className="hidden xl:block w-4 h-4 text-[var(--text-tertiary)] ml-auto group-hover:text-[var(--text-secondary)] transition-colors" />
        </button>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-[var(--surface)]/90 backdrop-blur-2xl border-t border-[var(--border)] z-50 safe-bottom">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl transition-all duration-200 ${
                isActive ? "text-[var(--accent)]" : "text-[var(--text-tertiary)]"
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
              {isActive && <div className="w-4 h-0.5 rounded-full bg-[var(--accent)] mt-0.5" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
