"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import type { RoutineBlock } from "@/lib/types";
import { Plus, Trash2, Clock, Pencil, Check, X } from "lucide-react";

const PALETTE = ["#22c55e", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#e5a01e", "#06b6d4", "#ef4444"];

const DAYS = [
  { i: 1, label: "L" },
  { i: 2, label: "M" },
  { i: 3, label: "X" },
  { i: 4, label: "J" },
  { i: 5, label: "V" },
  { i: 6, label: "S" },
  { i: 0, label: "D" },
];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export function RoutineManager() {
  const { state, dispatch } = useStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RoutineBlock | null>(null);
  const [adding, setAdding] = useState(false);

  function startEdit(r: RoutineBlock) {
    setEditingId(r.id);
    setDraft({ ...r });
    setAdding(false);
  }

  function startAdd() {
    const newR: RoutineBlock = {
      id: crypto.randomUUID(),
      name: "",
      startTime: "09:00",
      endTime: "09:30",
      color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
    };
    setDraft(newR);
    setEditingId(newR.id);
    setAdding(true);
  }

  function save() {
    if (!draft || !draft.name.trim()) return;
    if (adding) dispatch({ type: "ADD_ROUTINE", routine: draft });
    else dispatch({ type: "UPDATE_ROUTINE", routine: draft });
    cancel();
  }

  function cancel() {
    setEditingId(null);
    setDraft(null);
    setAdding(false);
  }

  return (
    <div className="space-y-2">
      {state.routines.map((r) =>
        editingId === r.id && draft ? (
          <RoutineEditor key={r.id} draft={draft} setDraft={setDraft} onSave={save} onCancel={cancel} />
        ) : (
          <div
            key={r.id}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-[var(--border)] group"
          >
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: r.color }} />
            <span className="text-[12px] font-mono tabular-nums text-[var(--text-tertiary)] shrink-0">
              {r.startTime}–{r.endTime}
            </span>
            <span className="text-[13px] text-[var(--text-primary)] flex-1 truncate">{r.name}</span>
            <button
              onClick={() => startEdit(r)}
              className="transition p-1.5 rounded-lg hover:bg-white/[0.05] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              aria-label="Editar"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                if (confirm(`¿Borrar la rutina “${r.name}”?`))
                  dispatch({ type: "DELETE_ROUTINE", id: r.id });
              }}
              className="transition p-1.5 rounded-lg hover:bg-[var(--danger)]/10 text-[var(--text-tertiary)] hover:text-[var(--danger)]"
              aria-label="Borrar"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )
      )}

      {adding && draft && (
        <RoutineEditor draft={draft} setDraft={setDraft} onSave={save} onCancel={cancel} />
      )}

      {!adding && (
        <button
          onClick={startAdd}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-[var(--border-hover)] text-[12px] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)]/40 transition"
        >
          <Plus className="w-4 h-4" /> Agregar bloque
        </button>
      )}
    </div>
  );
}

function RoutineEditor({
  draft,
  setDraft,
  onSave,
  onCancel,
}: {
  draft: RoutineBlock;
  setDraft: (r: RoutineBlock) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="px-3 py-3 rounded-xl bg-white/[0.03] border border-[var(--accent)]/30 space-y-2.5">
      <input
        autoFocus
        value={draft.name}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        onKeyDown={(e) => e.key === "Enter" && onSave()}
        placeholder="Nombre del bloque"
        className="w-full bg-transparent text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"
      />
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/[0.03]">
          <Clock className="w-3 h-3 text-[var(--text-tertiary)]" />
          <input
            type="time"
            value={draft.startTime}
            onChange={(e) => setDraft({ ...draft, startTime: e.target.value })}
            className="bg-transparent text-[12px] text-[var(--text-primary)] outline-none [color-scheme:dark]"
          />
          <span className="text-[var(--text-tertiary)]">–</span>
          <input
            type="time"
            value={draft.endTime}
            onChange={(e) => setDraft({ ...draft, endTime: e.target.value })}
            className="bg-transparent text-[12px] text-[var(--text-primary)] outline-none [color-scheme:dark]"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {PALETTE.map((c) => (
            <button
              key={c}
              onClick={() => setDraft({ ...draft, color: c })}
              className={`w-4 h-4 rounded-full transition ${draft.color === c ? "ring-2 ring-white/40 ring-offset-1 ring-offset-[#101014]" : ""}`}
              style={{ background: c }}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] text-[var(--text-tertiary)] mr-1">Días:</span>
        {DAYS.map((d) => {
          const active = (draft.days ?? ALL_DAYS).includes(d.i);
          return (
            <button
              key={d.i}
              onClick={() => {
                const cur = draft.days ?? ALL_DAYS;
                const next = cur.includes(d.i) ? cur.filter((x) => x !== d.i) : [...cur, d.i].sort();
                setDraft({ ...draft, days: next.length === 7 ? undefined : next });
              }}
              className={`w-6 h-6 rounded-md text-[11px] font-semibold transition ${
                active
                  ? "bg-[var(--accent)] text-black"
                  : "bg-white/[0.04] text-[var(--text-tertiary)] hover:bg-white/[0.08]"
              }`}
            >
              {d.label}
            </button>
          );
        })}
        <button
          onClick={() => setDraft({ ...draft, days: [1, 2, 3, 4, 5] })}
          className="ml-1 text-[10px] text-[var(--accent)] hover:underline"
        >
          L–V
        </button>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onSave}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-black text-[12px] font-semibold hover:bg-[var(--accent-muted)] transition"
        >
          <Check className="w-3.5 h-3.5" /> Guardar
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] text-[var(--text-secondary)] text-[12px] hover:bg-white/[0.08] transition"
        >
          <X className="w-3.5 h-3.5" /> Cancelar
        </button>
      </div>
    </div>
  );
}
