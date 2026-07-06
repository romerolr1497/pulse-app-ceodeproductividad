"use client";

import { useEffect, useState } from "react";
import { useStore, localDateStr } from "@/lib/store";
import type { CalendarEvent, RoutineBlock, Reservation, FlexRoutine } from "@/lib/types";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Bell,
  Check,
  X,
  Calendar as CalendarIcon,
  Bookmark,
  Dumbbell,
} from "lucide-react";

function addDaysStr(dateStr: string, delta: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return localDateStr(d);
}

function formatLong(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const s = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function timeToMin(t?: string): number {
  if (!t) return -1;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// ¿La rutina aplica a este día de la semana?
function routineOnDay(r: RoutineBlock, weekday: number): boolean {
  if (!r.days || r.days.length === 0) return true;
  return r.days.includes(weekday);
}

interface EventFormState {
  title: string;
  time: string;
  notes: string;
  notify: boolean;
  notifyMinutes: number;
}

const emptyForm: EventFormState = {
  title: "",
  time: "",
  notes: "",
  notify: false,
  notifyMinutes: 30,
};

interface ResFormState {
  title: string;
  startTime: string;
  endTime: string;
  notes: string;
  notify: boolean;
  notifyMinutes: number;
}

const emptyRes: ResFormState = {
  title: "",
  startTime: "",
  endTime: "",
  notes: "",
  notify: false,
  notifyMinutes: 15,
};

const RESERVATION_COLOR = "#a78bfa"; // violeta: bloque tentativo/solapable
const FLEX_PALETTE = ["#34d399", "#22c55e", "#38bdf8", "#f59e0b", "#f472b6", "#a78bfa"];

export function Agenda() {
  const { state, dispatch } = useStore();
  const [selected, setSelected] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EventFormState>(emptyForm);

  // Reservas
  const [showResForm, setShowResForm] = useState(false);
  const [editingResId, setEditingResId] = useState<string | null>(null);
  const [resForm, setResForm] = useState<ResFormState>(emptyRes);

  // Rutinas flexibles
  const [showFlexForm, setShowFlexForm] = useState(false);
  const [flexName, setFlexName] = useState("");

  // Mount guard para evitar mismatch de hidratación con fechas locales
  useEffect(() => {
    setSelected(localDateStr());
  }, []);

  if (!selected) {
    return <div className="max-w-2xl mx-auto h-40" />;
  }

  const today = localDateStr();
  const isToday = selected === today;
  const weekday = new Date(selected + "T00:00:00").getDay();

  const dayEvents = state.events
    .filter((e) => e.date === selected)
    .sort((a, b) => timeToMin(a.time) - timeToMin(b.time));

  const dayRoutines = state.routines
    .filter((r) => routineOnDay(r, weekday))
    .slice()
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const dayReservations = state.reservations
    .filter((r) => r.date === selected)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const flexRoutines = state.flexRoutines;

  const pendingTasks = state.tasks.filter((t) => !t.completed);

  function openNew() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(ev: CalendarEvent) {
    setForm({
      title: ev.title,
      time: ev.time ?? "",
      notes: ev.notes ?? "",
      notify: ev.notifyMinutes !== undefined,
      notifyMinutes: ev.notifyMinutes ?? 30,
    });
    setEditingId(ev.id);
    setShowForm(true);
  }

  function saveEvent(e: React.FormEvent) {
    e.preventDefault();
    const title = form.title.trim();
    if (!title || !selected) return;
    const base: CalendarEvent = {
      id: editingId ?? crypto.randomUUID(),
      title,
      date: selected,
      time: form.time || undefined,
      notes: form.notes.trim() || undefined,
      notifyMinutes: form.notify ? form.notifyMinutes : undefined,
      color: "#e5a01e",
    };
    dispatch({ type: editingId ? "UPDATE_EVENT" : "ADD_EVENT", event: base });
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  // --- Reservas ---
  function openNewRes() {
    setResForm(emptyRes);
    setEditingResId(null);
    setShowResForm(true);
  }

  function openEditRes(r: Reservation) {
    setResForm({
      title: r.title,
      startTime: r.startTime,
      endTime: r.endTime ?? "",
      notes: r.notes ?? "",
      notify: r.notifyMinutes !== undefined,
      notifyMinutes: r.notifyMinutes ?? 15,
    });
    setEditingResId(r.id);
    setShowResForm(true);
  }

  function saveRes(e: React.FormEvent) {
    e.preventDefault();
    const title = resForm.title.trim();
    if (!title || !resForm.startTime || !selected) return;
    const base: Reservation = {
      id: editingResId ?? crypto.randomUUID(),
      title,
      date: selected,
      startTime: resForm.startTime,
      endTime: resForm.endTime || undefined,
      notes: resForm.notes.trim() || undefined,
      notifyMinutes: resForm.notify ? resForm.notifyMinutes : undefined,
      color: RESERVATION_COLOR,
    };
    dispatch({ type: editingResId ? "UPDATE_RESERVATION" : "ADD_RESERVATION", reservation: base });
    setShowResForm(false);
    setEditingResId(null);
    setResForm(emptyRes);
  }

  // --- Rutinas flexibles ---
  function addFlex(e: React.FormEvent) {
    e.preventDefault();
    const name = flexName.trim();
    if (!name) return;
    const flexRoutine: FlexRoutine = {
      id: crypto.randomUUID(),
      name,
      color: FLEX_PALETTE[state.flexRoutines.length % FLEX_PALETTE.length],
      completedDates: [],
    };
    dispatch({ type: "ADD_FLEX_ROUTINE", flexRoutine });
    setFlexName("");
    setShowFlexForm(false);
  }

  return (
    <div className="max-w-2xl mx-auto pb-8">
      {/* Encabezado */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 rounded-xl bg-[var(--accent-subtle)] flex items-center justify-center">
          <CalendarIcon size={18} className="text-[var(--accent)]" />
        </div>
        <div>
          <h1 className="font-heading text-lg font-semibold text-[var(--text-primary)] leading-tight">
            Agenda
          </h1>
          <p className="text-[11px] text-[var(--text-tertiary)]">tu día, hora por hora</p>
        </div>
      </div>

      {/* Navegador de día */}
      <div className="glass-card flex items-center justify-between px-3 py-2.5 mb-4">
        <button
          onClick={() => setSelected(addDaysStr(selected, -1))}
          aria-label="Día anterior"
          className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-white/[0.04] transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <p className="text-[13px] font-semibold text-[var(--text-primary)]">
            {formatLong(selected)}
          </p>
          {!isToday && (
            <button
              onClick={() => setSelected(today)}
              className="text-[11px] text-[var(--accent)] hover:underline"
            >
              Volver a hoy
            </button>
          )}
          {isToday && <p className="text-[11px] text-[var(--text-tertiary)]">Hoy</p>}
        </div>
        <button
          onClick={() => setSelected(addDaysStr(selected, 1))}
          aria-label="Día siguiente"
          className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-white/[0.04] transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Eventos / turnos */}
      <div className="glass-card overflow-hidden mb-4">
        <div className="px-5 py-3 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-[var(--text-secondary)] font-heading">
            Eventos y turnos
          </h2>
          <button
            onClick={openNew}
            className="flex items-center gap-1 text-[11px] text-[var(--accent)] hover:text-[var(--accent-muted)] transition-colors"
          >
            <Plus size={14} /> Agregar
          </button>
        </div>

        {showForm && (
          <form onSubmit={saveEvent} className="px-5 py-4 border-b border-[var(--border)] flex flex-col gap-2.5 bg-white/[0.02]">
            <input
              autoFocus
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Ej: Turno dentista"
              className="bg-[rgba(255,255,255,0.04)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-muted)]"
            />
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
                className="bg-[rgba(255,255,255,0.04)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-muted)]"
              />
              <span className="text-[11px] text-[var(--text-tertiary)]">
                (dejá vacío si es todo el día)
              </span>
            </div>
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Nota (opcional)"
              className="bg-[rgba(255,255,255,0.04)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-muted)]"
            />
            <label className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={form.notify}
                onChange={(e) => setForm({ ...form, notify: e.target.checked })}
                className="accent-[var(--accent)]"
              />
              Avisarme
              {form.notify && (
                <select
                  value={form.notifyMinutes}
                  onChange={(e) => setForm({ ...form, notifyMinutes: Number(e.target.value) })}
                  className="bg-[rgba(255,255,255,0.04)] border border-[var(--border)] rounded-lg px-2 py-1 text-[12px] text-[var(--text-primary)] focus:outline-none"
                >
                  <option value={5}>5 min antes</option>
                  <option value={10}>10 min antes</option>
                  <option value={15}>15 min antes</option>
                  <option value={30}>30 min antes</option>
                  <option value={60}>1 h antes</option>
                </select>
              )}
            </label>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                className="flex-1 bg-[var(--accent)] text-black text-[13px] font-medium rounded-lg py-2 hover:bg-[var(--accent-muted)] transition-colors"
              >
                {editingId ? "Guardar cambios" : "Agregar evento"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--danger)] hover:bg-white/[0.04] transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </form>
        )}

        {dayEvents.length === 0 && !showForm ? (
          <p className="px-5 py-6 text-[12px] text-[var(--text-tertiary)] text-center">
            No hay eventos este día. Tocá “Agregar” o pedíselo a Beat por voz.
          </p>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {dayEvents.map((ev) => (
              <div
                key={ev.id}
                className="flex items-center gap-3 px-5 py-3 group hover:bg-white/[0.02] transition-colors"
              >
                <button
                  onClick={() => dispatch({ type: "TOGGLE_EVENT", id: ev.id })}
                  aria-label="Marcar"
                  className={`w-5 h-5 rounded-full border shrink-0 flex items-center justify-center transition-colors ${
                    ev.completed
                      ? "bg-[var(--success)] border-[var(--success)]"
                      : "border-[var(--text-tertiary)]/50 hover:border-[var(--accent)]"
                  }`}
                >
                  {ev.completed && <Check size={12} className="text-black" strokeWidth={3} />}
                </button>
                <span className="w-12 text-[12px] font-mono tabular-nums text-[var(--text-tertiary)] shrink-0">
                  {ev.time ?? "—"}
                </span>
                <button
                  onClick={() => openEdit(ev)}
                  className="flex-1 text-left min-w-0"
                >
                  <p
                    className={`text-[13px] truncate ${
                      ev.completed
                        ? "text-[var(--text-tertiary)] line-through"
                        : "text-[var(--text-primary)]"
                    }`}
                  >
                    {ev.title}
                  </p>
                  {ev.notes && (
                    <p className="text-[11px] text-[var(--text-tertiary)] truncate">{ev.notes}</p>
                  )}
                </button>
                {ev.notifyMinutes !== undefined && (
                  <Bell size={13} className="text-[var(--accent)] shrink-0" />
                )}
                <button
                  onClick={() => dispatch({ type: "DELETE_EVENT", id: ev.id })}
                  aria-label="Borrar"
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-tertiary)] hover:text-[var(--danger)] opacity-0 group-hover:opacity-100 transition-all shrink-0"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rutinas del día */}
      <div className="glass-card overflow-hidden mb-4">
        <div className="px-5 py-3 border-b border-[var(--border)]">
          <h2 className="text-[13px] font-semibold text-[var(--text-secondary)] font-heading">
            Rutina del día
          </h2>
        </div>
        {dayRoutines.length === 0 ? (
          <p className="px-5 py-6 text-[12px] text-[var(--text-tertiary)] text-center">
            Sin rutinas para este día.
          </p>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {dayRoutines.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-5 py-2.5">
                <span className="w-12 text-[12px] font-mono tabular-nums text-[var(--text-tertiary)] shrink-0">
                  {r.startTime}
                </span>
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: r.color }}
                />
                <span className="flex-1 text-[13px] text-[var(--text-secondary)] truncate">
                  {r.name}
                </span>
                <span className="text-[11px] text-[var(--text-tertiary)] tabular-nums">
                  {r.startTime}–{r.endTime}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reservas (bloques de tiempo con prioridad, solapables) */}
      <div className="glass-card overflow-hidden mb-4">
        <div className="px-5 py-3 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bookmark size={15} style={{ color: RESERVATION_COLOR }} />
            <h2 className="text-[13px] font-semibold text-[var(--text-secondary)] font-heading">
              Reservas
            </h2>
          </div>
          <button
            onClick={openNewRes}
            className="flex items-center gap-1 text-[11px] text-[var(--accent)] hover:text-[var(--accent-muted)] transition-colors"
          >
            <Plus size={14} /> Reservar
          </button>
        </div>

        {showResForm && (
          <form onSubmit={saveRes} className="px-5 py-4 border-b border-[var(--border)] flex flex-col gap-2.5 bg-white/[0.02]">
            <input
              autoFocus
              value={resForm.title}
              onChange={(e) => setResForm({ ...resForm, title: e.target.value })}
              placeholder="Ej: Trabajar en proyecto X"
              className="bg-[rgba(255,255,255,0.04)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-muted)]"
            />
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={resForm.startTime}
                onChange={(e) => setResForm({ ...resForm, startTime: e.target.value })}
                className="bg-[rgba(255,255,255,0.04)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-muted)]"
              />
              <span className="text-[11px] text-[var(--text-tertiary)]">a</span>
              <input
                type="time"
                value={resForm.endTime}
                onChange={(e) => setResForm({ ...resForm, endTime: e.target.value })}
                className="bg-[rgba(255,255,255,0.04)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-muted)]"
              />
            </div>
            <input
              value={resForm.notes}
              onChange={(e) => setResForm({ ...resForm, notes: e.target.value })}
              placeholder="Nota (opcional)"
              className="bg-[rgba(255,255,255,0.04)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-muted)]"
            />
            <label className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={resForm.notify}
                onChange={(e) => setResForm({ ...resForm, notify: e.target.checked })}
                className="accent-[var(--accent)]"
              />
              Avisarme
              {resForm.notify && (
                <select
                  value={resForm.notifyMinutes}
                  onChange={(e) => setResForm({ ...resForm, notifyMinutes: Number(e.target.value) })}
                  className="bg-[rgba(255,255,255,0.04)] border border-[var(--border)] rounded-lg px-2 py-1 text-[12px] text-[var(--text-primary)] focus:outline-none"
                >
                  <option value={5}>5 min antes</option>
                  <option value={10}>10 min antes</option>
                  <option value={15}>15 min antes</option>
                  <option value={30}>30 min antes</option>
                  <option value={60}>1 h antes</option>
                </select>
              )}
            </label>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                className="flex-1 bg-[var(--accent)] text-black text-[13px] font-medium rounded-lg py-2 hover:bg-[var(--accent-muted)] transition-colors"
              >
                {editingResId ? "Guardar cambios" : "Reservar tiempo"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowResForm(false);
                  setEditingResId(null);
                }}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--danger)] hover:bg-white/[0.04] transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </form>
        )}

        {dayReservations.length === 0 && !showResForm ? (
          <p className="px-5 py-6 text-[12px] text-[var(--text-tertiary)] text-center">
            Sin reservas. Bloqueá tiempo con prioridad (se puede pisar con un turno si surge).
          </p>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {dayReservations.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 px-5 py-3 group hover:bg-white/[0.02] transition-colors border-l-2"
                style={{ borderLeftColor: RESERVATION_COLOR }}
              >
                <span className="w-24 text-[12px] font-mono tabular-nums text-[var(--text-tertiary)] shrink-0">
                  {r.startTime}{r.endTime ? `–${r.endTime}` : ""}
                </span>
                <button onClick={() => openEditRes(r)} className="flex-1 text-left min-w-0">
                  <p className="text-[13px] text-[var(--text-primary)] truncate">{r.title}</p>
                  {r.notes && (
                    <p className="text-[11px] text-[var(--text-tertiary)] truncate">{r.notes}</p>
                  )}
                </button>
                {r.notifyMinutes !== undefined && (
                  <Bell size={13} className="text-[var(--accent)] shrink-0" />
                )}
                <button
                  onClick={() => dispatch({ type: "DELETE_RESERVATION", id: r.id })}
                  aria-label="Borrar"
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-tertiary)] hover:text-[var(--danger)] opacity-0 group-hover:opacity-100 transition-all shrink-0"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rutinas flexibles (hábitos sin hora, se marcan al hacerlas) */}
      <div className="glass-card overflow-hidden mb-4">
        <div className="px-5 py-3 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Dumbbell size={15} className="text-[var(--success)]" />
            <h2 className="text-[13px] font-semibold text-[var(--text-secondary)] font-heading">
              Rutinas flexibles
            </h2>
          </div>
          <button
            onClick={() => setShowFlexForm((v) => !v)}
            className="flex items-center gap-1 text-[11px] text-[var(--accent)] hover:text-[var(--accent-muted)] transition-colors"
          >
            <Plus size={14} /> Agregar
          </button>
        </div>

        {showFlexForm && (
          <form onSubmit={addFlex} className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-2 bg-white/[0.02]">
            <input
              autoFocus
              value={flexName}
              onChange={(e) => setFlexName(e.target.value)}
              placeholder="Ej: Deporte, Meditar, Leer"
              className="flex-1 bg-[rgba(255,255,255,0.04)] border border-[var(--border)] rounded-lg px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-muted)]"
            />
            <button
              type="submit"
              className="bg-[var(--accent)] text-black text-[13px] font-medium rounded-lg px-4 py-2 hover:bg-[var(--accent-muted)] transition-colors"
            >
              Crear
            </button>
          </form>
        )}

        {flexRoutines.length === 0 && !showFlexForm ? (
          <p className="px-5 py-6 text-[12px] text-[var(--text-tertiary)] text-center">
            Sin rutinas flexibles. Agregá una (ej: deporte) y marcala el día que la hacés.
          </p>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {flexRoutines.map((f) => {
              const done = f.completedDates.includes(selected);
              return (
                <div
                  key={f.id}
                  className="flex items-center gap-3 px-5 py-3 group hover:bg-white/[0.02] transition-colors"
                >
                  <button
                    onClick={() => dispatch({ type: "TOGGLE_FLEX_ROUTINE", id: f.id, date: selected })}
                    aria-label="Marcar"
                    className="w-5 h-5 rounded-full border shrink-0 flex items-center justify-center transition-colors"
                    style={{
                      backgroundColor: done ? f.color : "transparent",
                      borderColor: done ? f.color : "var(--text-tertiary)",
                    }}
                  >
                    {done && <Check size={12} className="text-black" strokeWidth={3} />}
                  </button>
                  <span
                    className={`flex-1 text-[13px] truncate ${
                      done ? "text-[var(--text-tertiary)]" : "text-[var(--text-primary)]"
                    }`}
                  >
                    {f.name}
                  </span>
                  <span className="text-[11px] text-[var(--text-tertiary)] tabular-nums shrink-0">
                    {f.completedDates.length}× total
                  </span>
                  <button
                    onClick={() => dispatch({ type: "DELETE_FLEX_ROUTINE", id: f.id })}
                    aria-label="Borrar"
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-tertiary)] hover:text-[var(--danger)] opacity-0 group-hover:opacity-100 transition-all shrink-0"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tareas pendientes (solo referencia de hoy) */}
      {isToday && pendingTasks.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--border)]">
            <h2 className="text-[13px] font-semibold text-[var(--text-secondary)] font-heading">
              Tareas pendientes
            </h2>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {pendingTasks.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-5 py-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shrink-0" />
                <span className="flex-1 text-[13px] text-[var(--text-secondary)] truncate">
                  {t.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
