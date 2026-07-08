"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";

export function Projects() {
  const { state, dispatch } = useStore();
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [newTask, setNewTask] = useState("");

  function addProjectTask(projectId: string, e: React.FormEvent) {
    e.preventDefault();
    if (!newTask.trim()) return;
    dispatch({
      type: "ADD_PROJECT_TASK",
      projectId,
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
    <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
        Proyectos
      </h2>

      {/* Project tabs */}
      <div className="flex gap-2 mb-3">
        {state.projects.map((project) => (
          <button
            key={project.id}
            onClick={() => setActiveProject(activeProject === project.id ? null : project.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeProject === project.id
                ? "text-white"
                : "text-zinc-400 hover:text-zinc-200 bg-zinc-800"
            }`}
            style={activeProject === project.id ? { backgroundColor: project.color + "30", color: project.color } : {}}
          >
            <span
              className="inline-block w-2 h-2 rounded-full mr-1.5"
              style={{ backgroundColor: project.color }}
            />
            {project.name}
            {project.tasks.filter((t) => !t.completed).length > 0 && (
              <span className="ml-1.5 bg-zinc-700 px-1.5 py-0.5 rounded text-[10px]">
                {project.tasks.filter((t) => !t.completed).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Active project content */}
      {activeProject && (
        <div className="border-t border-zinc-800 pt-3">
          {(() => {
            const project = state.projects.find((p) => p.id === activeProject);
            if (!project) return null;
            const pending = project.tasks.filter((t) => !t.completed);
            const completed = project.tasks.filter((t) => t.completed);

            return (
              <div>
                <form onSubmit={(e) => addProjectTask(project.id, e)} className="mb-3">
                  <input
                    value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                    placeholder={`Nueva tarea en ${project.name}...`}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                  />
                </form>

                <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
                  {pending.length === 0 && (
                    <p className="text-xs text-zinc-600 text-center py-3">Sin tareas pendientes</p>
                  )}
                  {pending.map((task) => (
                    <div key={task.id} className="flex items-center gap-2.5 group px-2 py-1.5 rounded-lg hover:bg-zinc-800/50">
                      <button
                        onClick={() => dispatch({ type: "TOGGLE_PROJECT_TASK", projectId: project.id, taskId: task.id })}
                        className="w-4 h-4 rounded border-2 shrink-0 hover:border-indigo-400 transition"
                        style={{ borderColor: project.color + "80" }}
                      />
                      <span className="text-sm text-zinc-300 flex-1">{task.title}</span>
                      <button
                        onClick={() => {
                          if (confirm(`¿Borrar la tarea “${task.title}”?`))
                            dispatch({ type: "DELETE_PROJECT_TASK", projectId: project.id, taskId: task.id });
                        }}
                        className="opacity-60 hover:opacity-100 text-zinc-600 hover:text-red-400 transition"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  {completed.length > 0 && (
                    <details className="mt-2">
                      <summary className="text-xs text-zinc-600 cursor-pointer hover:text-zinc-400">
                        {completed.length} hecha{completed.length > 1 ? "s" : ""}
                      </summary>
                      <div className="mt-1 space-y-1">
                        {completed.map((task) => (
                          <div key={task.id} className="flex items-center gap-2.5 px-2 py-1">
                            <div className="w-4 h-4 rounded bg-green-500/20 border-2 border-green-500 flex items-center justify-center shrink-0">
                              <svg className="w-2.5 h-2.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                            <span className="text-sm text-zinc-600 line-through">{task.title}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
