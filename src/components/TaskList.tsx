"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Plus, Check, Trash2 } from "lucide-react";
import { fireConfetti } from "@/lib/confetti";

export function TaskList() {
  const { state, dispatch } = useStore();
  const [newTask, setNewTask] = useState("");
  const [showInput, setShowInput] = useState(false);

  const pending = state.tasks.filter((t) => !t.completed);
  const completed = state.tasks.filter((t) => t.completed);

  function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTask.trim()) return;
    dispatch({
      type: "ADD_TASK",
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

  return (
    <div className="glass-card overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between shrink-0">
        <h2 className="text-[13px] font-semibold text-[var(--text-secondary)] font-heading tracking-tight">Tareas</h2>
        <button
          onClick={() => setShowInput(!showInput)}
          className="w-6 h-6 rounded-md bg-[var(--accent-subtle)] text-[var(--accent)] flex items-center justify-center hover:bg-[var(--accent)]/20 transition"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Add task input */}
      {showInput && (
        <form onSubmit={addTask} className="px-5 py-3 border-b border-[var(--border)] shrink-0">
          <input
            autoFocus
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="Nueva tarea..."
            className="w-full bg-white/[0.03] border border-[var(--border)] rounded-lg px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]/30 transition"
          />
        </form>
      )}

      {/* Tasks */}
      <div className="flex-1 overflow-y-auto">
        {pending.length === 0 && !showInput && (
          <div className="px-5 py-10 text-center">
            <p className="text-[12px] text-[var(--text-tertiary)]">Sin pendientes</p>
          </div>
        )}
        <div className="divide-y divide-[var(--border)]">
          {pending.map((task) => (
            <div key={task.id} className="flex items-center gap-3 px-5 py-2.5 group hover:bg-white/[0.02] transition">
              <button
                onClick={(e) => {
                  fireConfetti(e.clientX, e.clientY);
                  dispatch({ type: "TOGGLE_TASK", id: task.id });
                }}
                className="w-4 h-4 rounded border border-[var(--text-tertiary)]/40 shrink-0 hover:border-[var(--accent)] transition"
              />
              <span className="flex-1 text-[13px] text-[var(--text-secondary)] min-w-0 truncate">{task.title}</span>
              <button
                onClick={() => dispatch({ type: "DELETE_TASK", id: task.id })}
                className="opacity-60 hover:opacity-100 p-1 hover:bg-[var(--danger)]/10 rounded transition"
              >
                <Trash2 className="w-3 h-3 text-[var(--text-tertiary)] hover:text-[var(--danger)]" />
              </button>
            </div>
          ))}
        </div>

        {completed.length > 0 && (
          <details className="border-t border-[var(--border)]">
            <summary className="px-5 py-2 text-[11px] text-[var(--text-tertiary)] cursor-pointer hover:text-[var(--text-secondary)] select-none">
              {completed.length} completada{completed.length > 1 ? "s" : ""}
            </summary>
            <div className="divide-y divide-[var(--border)]">
              {completed.map((task) => (
                <div key={task.id} className="flex items-center gap-3 px-5 py-2">
                  <div className="w-4 h-4 rounded bg-[var(--success)]/15 border border-[var(--success)]/30 flex items-center justify-center shrink-0">
                    <Check className="w-2.5 h-2.5 text-[var(--success)]" strokeWidth={3} />
                  </div>
                  <span className="text-[12px] text-[var(--text-tertiary)] line-through truncate">{task.title}</span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
