"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore, localDateStr } from "@/lib/store";
import {
  Home,
  FolderKanban,
  BarChart3,
  Settings as SettingsIcon,
  Plus,
  Download,
  Search,
  CornerDownLeft,
} from "lucide-react";

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  run: () => void;
  keywords?: string;
}

export function CommandPalette() {
  const router = useRouter();
  const { state, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Atajo global: Ctrl/Cmd+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const baseCommands: Command[] = useMemo(
    () => [
      { id: "go-home", label: "Ir a Hoy", icon: Home, keywords: "inicio dashboard rutina", run: () => router.push("/") },
      { id: "go-projects", label: "Ir a Proyectos", icon: FolderKanban, keywords: "workspace tareas", run: () => router.push("/projects") },
      { id: "go-stats", label: "Ir a Estadísticas", icon: BarChart3, keywords: "analytics metricas graficos", run: () => router.push("/stats") },
      { id: "go-settings", label: "Ir a Configuración", icon: SettingsIcon, keywords: "ajustes notificaciones rutina datos", run: () => router.push("/settings") },
      {
        id: "export",
        label: "Exportar datos (backup)",
        icon: Download,
        keywords: "backup json descargar",
        run: () => {
          const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `pulse-backup-${localDateStr()}.json`;
          a.click();
          URL.revokeObjectURL(url);
        },
      },
    ],
    [router, state]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list: Command[] = [];
    if (q) {
      list.push({
        id: "new-task",
        label: `Crear tarea: “${query.trim()}”`,
        hint: "Enter",
        icon: Plus,
        run: () => {
          dispatch({
            type: "ADD_TASK",
            task: {
              id: crypto.randomUUID(),
              title: query.trim(),
              completed: false,
              priority: 2,
              createdAt: new Date().toISOString(),
            },
          });
          router.push("/");
        },
      });
    }
    const matches = baseCommands.filter(
      (c) => !q || c.label.toLowerCase().includes(q) || c.keywords?.includes(q)
    );
    return [...list, ...matches];
  }, [query, baseCommands, dispatch, router]);

  useEffect(() => {
    if (active >= filtered.length) setActive(0);
  }, [filtered.length, active]);

  function exec(cmd: Command) {
    cmd.run();
    setOpen(false);
  }

  function onListKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = filtered[active];
      if (cmd) exec(cmd);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh] px-4 bg-black/50 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg glass-card-raised overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
          <Search className="w-4 h-4 text-[var(--text-tertiary)] shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onListKey}
            placeholder="Buscar o crear tarea…"
            className="flex-1 bg-transparent text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"
          />
          <kbd className="text-[10px] text-[var(--text-tertiary)] border border-[var(--border)] rounded px-1.5 py-0.5">ESC</kbd>
        </div>

        <div className="max-h-[320px] overflow-y-auto py-1.5">
          {filtered.length === 0 && (
            <p className="px-4 py-6 text-center text-[12px] text-[var(--text-tertiary)]">Sin resultados</p>
          )}
          {filtered.map((cmd, i) => {
            const Icon = cmd.icon;
            const isActive = i === active;
            return (
              <button
                key={cmd.id}
                onMouseEnter={() => setActive(i)}
                onClick={() => exec(cmd)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition ${
                  isActive ? "bg-[var(--accent-subtle)]" : "hover:bg-white/[0.03]"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-[var(--accent)]" : "text-[var(--text-tertiary)]"}`} />
                <span className={`flex-1 text-[13px] ${isActive ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>
                  {cmd.label}
                </span>
                {isActive && <CornerDownLeft className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />}
              </button>
            );
          })}
        </div>

        <div className="px-4 py-2 border-t border-[var(--border)] flex items-center gap-3 text-[10px] text-[var(--text-tertiary)]">
          <span>↑↓ navegar</span>
          <span>↵ ejecutar</span>
          <span className="ml-auto">⌘K / Ctrl+K</span>
        </div>
      </div>
    </div>
  );
}
