"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Plus, Check, Trash2, ChevronRight, X } from "lucide-react";

const PALETTE = ["#8b5cf6", "#3b82f6", "#22c55e", "#f59e0b", "#ec4899", "#e5a01e", "#06b6d4", "#ef4444"];

export default function ProjectsPage() {
  const { state, dispatch } = useStore();
  const [activeProject, setActiveProject] = useState(state.projects[0]?.id || "");
  const [newTask, setNewTask] = useState("");
  const [addingProject, setAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectColor, setNewProjectColor] = useState(PALETTE[0]);

  const project = state.projects.find((p) => p.id === activeProject);

  function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTask.trim() || !activeProject) return;
    dispatch({
      type: "ADD_PROJECT_TASK",
      projectId: activeProject,
      task: {
        id: crypto.randomUUID(),
        title: newTask.trim(),
        completed: false,
        priority: 2,
        createdAt: new Date().toISOString(),
      },
    });
    setNewTask("");
  }

  function addProject(e: React.FormEvent) {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    const id = crypto.randomUUID();
    dispatch({
      type: "ADD_PROJECT",
      project: { id, name: newProjectName.trim(), color: newProjectColor, tasks: [] },
    });
    setActiveProject(id);
    setNewProjectName("");
    setNewProjectColor(PALETTE[Math.floor(Math.random() * PALETTE.length)]);
    setAddingProject(false);
  }

  function deleteProject(id: string) {
    if (!confirm("¿Borrar este proyecto y todas sus tareas?")) return;
    dispatch({ type: "DELETE_PROJECT", id });
    if (activeProject === id) {
      const remaining = state.projects.filter((p) => p.id !== id);
      setActiveProject(remaining[0]?.id || "");
    }
  }

  return (
    <div className="p-4 lg:p-6 xl:p-8 max-w-[1400px] mx-auto">
      <header className="mb-5 lg:mb-6">
        <p className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-widest">Workspace</p>
        <h1 className="font-heading text-xl lg:text-2xl font-bold text-[var(--text-primary)] tracking-tight mt-0.5">
          Proyectos
        </h1>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4">
        {/* Project cards - left */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-3">
          {state.projects.map((p) => {
            const done = p.tasks.filter((t) => t.completed).length;
            const total = p.tasks.length;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            const isActive = activeProject === p.id;

            return (
              <button
                key={p.id}
                onClick={() => setActiveProject(p.id)}
                className={`w-full glass-card glow-hover p-4 text-left transition-all duration-200 ${
                  isActive ? "!border-[var(--accent)]/30 bg-[var(--accent-subtle)]" : ""
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: p.color }}
                    />
                    <span className={`text-[13px] font-medium ${isActive ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>
                      {p.name}
                    </span>
                  </div>
                  {isActive && <ChevronRight className="w-3.5 h-3.5 text-[var(--accent)]" />}
                </div>

                {/* Mini progress */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-1 bg-white/[0.04] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: p.color }}
                    />
                  </div>
                  <span className="text-[11px] tabular-nums text-[var(--text-tertiary)]">{pct}%</span>
                </div>

                <div className="flex items-center gap-3 mt-2.5">
                  <span className="text-[10px] text-[var(--text-tertiary)]">
                    {total - done} pendiente{(total - done) !== 1 ? "s" : ""}
                  </span>
                  <span className="text-[10px] text-[var(--text-tertiary)]">·</span>
                  <span className="text-[10px] text-[var(--text-tertiary)]">{done} hecha{done !== 1 ? "s" : ""}</span>
                </div>
              </button>
            );
          })}

          {/* Nuevo proyecto */}
          {addingProject ? (
            <form onSubmit={addProject} className="glass-card p-4 space-y-3 border-[var(--accent)]/30">
              <input
                autoFocus
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Nombre del proyecto"
                className="w-full bg-transparent text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"
              />
              <div className="flex items-center gap-1.5">
                {PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewProjectColor(c)}
                    className={`w-4 h-4 rounded-full transition ${newProjectColor === c ? "ring-2 ring-white/40 ring-offset-1 ring-offset-[#101014]" : ""}`}
                    style={{ background: c }}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-black text-[12px] font-semibold hover:bg-[var(--accent-muted)] transition"
                >
                  <Check className="w-3.5 h-3.5" /> Crear
                </button>
                <button
                  type="button"
                  onClick={() => { setAddingProject(false); setNewProjectName(""); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] text-[var(--text-secondary)] text-[12px] hover:bg-white/[0.08] transition"
                >
                  <X className="w-3.5 h-3.5" /> Cancelar
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setAddingProject(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-[var(--border-hover)] text-[12px] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)]/40 transition"
            >
              <Plus className="w-4 h-4" /> Nuevo proyecto
            </button>
          )}
        </div>

        {/* Project content - right */}
        <div className="lg:col-span-8 xl:col-span-9">
          {project ? (
            <div className="glass-card overflow-hidden">
              {/* Project header */}
              <div className="px-5 lg:px-6 py-4 border-b border-[var(--border)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-md"
                      style={{ backgroundColor: project.color }}
                    />
                    <h2 className="text-[15px] font-heading font-semibold text-[var(--text-primary)]">{project.name}</h2>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-[var(--text-tertiary)] tabular-nums">
                      {project.tasks.filter((t) => t.completed).length}/{project.tasks.length} completadas
                    </span>
                    <button
                      onClick={() => deleteProject(project.id)}
                      className="p-1.5 rounded-lg hover:bg-[var(--danger)]/10 text-[var(--text-tertiary)] hover:text-[var(--danger)] transition"
                      aria-label="Borrar proyecto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3 h-1 bg-white/[0.04] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: project.tasks.length > 0
                        ? `${(project.tasks.filter((t) => t.completed).length / project.tasks.length) * 100}%`
                        : "0%",
                      backgroundColor: project.color,
                    }}
                  />
                </div>
              </div>

              {/* Add task */}
              <div className="px-5 lg:px-6 py-3 border-b border-[var(--border)]">
                <form onSubmit={addTask} className="flex gap-2">
                  <div className="flex-1 relative">
                    <Plus className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                    <input
                      value={newTask}
                      onChange={(e) => setNewTask(e.target.value)}
                      placeholder="Agregar tarea..."
                      className="w-full bg-white/[0.03] border border-[var(--border)] rounded-lg pl-9 pr-4 py-2.5 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]/30 transition"
                    />
                  </div>
                </form>
              </div>

              {/* Task list */}
              <div className="divide-y divide-[var(--border)] max-h-[500px] overflow-y-auto">
                {project.tasks.filter((t) => !t.completed).length === 0 && (
                  <div className="px-6 py-12 text-center">
                    <p className="text-[12px] text-[var(--text-tertiary)]">Sin tareas pendientes</p>
                    <p className="text-[11px] text-[var(--text-tertiary)]/60 mt-1">Agregá una nueva arriba</p>
                  </div>
                )}
                {project.tasks
                  .filter((t) => !t.completed)
                  .map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 px-5 lg:px-6 py-3 group hover:bg-white/[0.02] transition"
                    >
                      <button
                        onClick={() => dispatch({ type: "TOGGLE_PROJECT_TASK", projectId: project.id, taskId: task.id })}
                        className="w-4 h-4 rounded border border-[var(--text-tertiary)]/40 shrink-0 hover:border-[var(--accent)] transition flex items-center justify-center"
                      >
                      </button>
                      <span className="flex-1 text-[13px] text-[var(--text-secondary)]">{task.title}</span>
                      <button
                        onClick={() => dispatch({ type: "DELETE_PROJECT_TASK", projectId: project.id, taskId: task.id })}
                        className="opacity-60 hover:opacity-100 p-1 hover:bg-[var(--danger)]/10 rounded transition"
                      >
                        <Trash2 className="w-3 h-3 text-[var(--text-tertiary)] hover:text-[var(--danger)]" />
                      </button>
                    </div>
                  ))}

                {/* Completed */}
                {project.tasks.filter((t) => t.completed).length > 0 && (
                  <details className="border-t border-[var(--border)]">
                    <summary className="px-5 lg:px-6 py-3 text-[11px] text-[var(--text-tertiary)] cursor-pointer hover:text-[var(--text-secondary)] select-none">
                      {project.tasks.filter((t) => t.completed).length} completada{project.tasks.filter((t) => t.completed).length > 1 ? "s" : ""}
                    </summary>
                    {project.tasks
                      .filter((t) => t.completed)
                      .map((task) => (
                        <div
                          key={task.id}
                          className="flex items-center gap-3 px-5 lg:px-6 py-2.5"
                        >
                          <div className="w-4 h-4 rounded bg-[var(--success)]/15 border border-[var(--success)]/30 flex items-center justify-center shrink-0">
                            <Check className="w-2.5 h-2.5 text-[var(--success)]" strokeWidth={3} />
                          </div>
                          <span className="text-[12px] text-[var(--text-tertiary)] line-through">{task.title}</span>
                        </div>
                      ))}
                  </details>
                )}
              </div>
            </div>
          ) : (
            <div className="glass-card flex items-center justify-center h-64 text-[var(--text-tertiary)] text-[13px]">
              Seleccioná un proyecto
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
