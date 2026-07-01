"use client";

import { createContext, useContext, useReducer, useEffect, useState, useRef, type ReactNode } from "react";
import type { RoutineBlock, Task, Project, DayLog, AppSettings } from "./types";
import { supabase, supabaseEnabled } from "./supabase";
import type { Session } from "@supabase/supabase-js";

interface State {
  routines: RoutineBlock[];
  tasks: Task[];
  projects: Project[];
  logs: DayLog[];
  settings: AppSettings;
  lastActiveDate: string; // YYYY-MM-DD del último día con actividad
  notes: Record<string, string>; // YYYY-MM-DD -> reflexión del día
}

type Action =
  | { type: "LOAD"; payload: State }
  | { type: "TOGGLE_ROUTINE"; id: string }
  | { type: "ADD_ROUTINE"; routine: RoutineBlock }
  | { type: "UPDATE_ROUTINE"; routine: RoutineBlock }
  | { type: "DELETE_ROUTINE"; id: string }
  | { type: "ADD_TASK"; task: Task }
  | { type: "TOGGLE_TASK"; id: string }
  | { type: "DELETE_TASK"; id: string }
  | { type: "ADD_PROJECT"; project: Project }
  | { type: "DELETE_PROJECT"; id: string }
  | { type: "ADD_PROJECT_TASK"; projectId: string; task: Task }
  | { type: "TOGGLE_PROJECT_TASK"; projectId: string; taskId: string }
  | { type: "DELETE_PROJECT_TASK"; projectId: string; taskId: string }
  | { type: "SAVE_DAY_LOG"; log: DayLog }
  | { type: "UPDATE_SETTINGS"; settings: Partial<AppSettings> }
  | { type: "SET_NOTE"; date: string; text: string }
  | { type: "ROLLOVER_DAY"; today: string }
  | { type: "IMPORT_DATA"; payload: Partial<State> }
  | { type: "RESET_ALL" };

const defaultRoutines: RoutineBlock[] = [
  { id: "1", name: "Ejercicio y suplementos", startTime: "08:15", endTime: "08:30", color: "#22c55e" },
  { id: "2", name: "Visma / Trading", startTime: "08:30", endTime: "16:00", color: "#3b82f6", days: [1, 2, 3, 4, 5] },
  { id: "3", name: "Bloque tareas pendientes", startTime: "16:00", endTime: "16:30", color: "#f59e0b", days: [1, 2, 3, 4, 5] },
  { id: "4", name: "Estudio Trading", startTime: "16:30", endTime: "17:00", color: "#8b5cf6", days: [1, 2, 3, 4, 5] },
  { id: "5", name: "Formación laboral", startTime: "17:00", endTime: "17:30", color: "#ec4899", days: [1, 2, 3, 4, 5] },
];

const defaultProjects: Project[] = [
  { id: "trading", name: "Trading", color: "#8b5cf6", tasks: [] },
  { id: "visma", name: "Visma", color: "#3b82f6", tasks: [] },
  { id: "bonevet", name: "Bonne Vet", color: "#22c55e", tasks: [] },
];

const defaultSettings: AppSettings = {
  notifications: false,
  notifyMinutesBefore: 0,
  wakeTime: "07:00",
  morningMotivation: true,
};

const initialState: State = {
  routines: defaultRoutines,
  tasks: [],
  projects: defaultProjects,
  logs: [],
  settings: defaultSettings,
  lastActiveDate: "",
  notes: {},
};

export function localDateStr(d = new Date()): string {
  // YYYY-MM-DD en hora local (no UTC)
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "LOAD":
      return action.payload;

    case "TOGGLE_ROUTINE":
      return {
        ...state,
        routines: state.routines.map((r) =>
          r.id === action.id ? { ...r, completed: !r.completed } : r
        ),
      };

    case "ADD_ROUTINE":
      return {
        ...state,
        routines: [...state.routines, action.routine].sort((a, b) =>
          a.startTime.localeCompare(b.startTime)
        ),
      };

    case "UPDATE_ROUTINE":
      return {
        ...state,
        routines: state.routines
          .map((r) => (r.id === action.routine.id ? action.routine : r))
          .sort((a, b) => a.startTime.localeCompare(b.startTime)),
      };

    case "DELETE_ROUTINE":
      return { ...state, routines: state.routines.filter((r) => r.id !== action.id) };

    case "ADD_TASK":
      return { ...state, tasks: [action.task, ...state.tasks] };

    case "TOGGLE_TASK":
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.id
            ? { ...t, completed: !t.completed, completedAt: !t.completed ? new Date().toISOString() : undefined }
            : t
        ),
      };

    case "DELETE_TASK":
      return { ...state, tasks: state.tasks.filter((t) => t.id !== action.id) };

    case "ADD_PROJECT":
      return { ...state, projects: [...state.projects, action.project] };

    case "DELETE_PROJECT":
      return { ...state, projects: state.projects.filter((p) => p.id !== action.id) };

    case "ADD_PROJECT_TASK":
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.projectId ? { ...p, tasks: [action.task, ...p.tasks] } : p
        ),
      };

    case "TOGGLE_PROJECT_TASK":
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.projectId
            ? {
                ...p,
                tasks: p.tasks.map((t) =>
                  t.id === action.taskId
                    ? { ...t, completed: !t.completed, completedAt: !t.completed ? new Date().toISOString() : undefined }
                    : t
                ),
              }
            : p
        ),
      };

    case "DELETE_PROJECT_TASK":
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.projectId
            ? { ...p, tasks: p.tasks.filter((t) => t.id !== action.taskId) }
            : p
        ),
      };

    case "SAVE_DAY_LOG":
      return {
        ...state,
        logs: [...state.logs.filter((l) => l.date !== action.log.date), action.log],
      };

    case "UPDATE_SETTINGS":
      return { ...state, settings: { ...state.settings, ...action.settings } };

    case "SET_NOTE":
      return { ...state, notes: { ...state.notes, [action.date]: action.text } };

    case "ROLLOVER_DAY": {
      // Archiva el día anterior y reinicia rutinas/tareas para el nuevo día
      const prevDate = state.lastActiveDate;
      let logs = state.logs;
      if (prevDate && prevDate !== action.today) {
        const routinesCompleted = state.routines.filter((r) => r.completed).length;
        const tasksCompleted = state.tasks.filter((t) => t.completed).length;
        const log: DayLog = {
          date: prevDate,
          routinesCompleted,
          routinesTotal: state.routines.length,
          tasksCompleted,
          tasksTotal: state.tasks.length,
        };
        logs = [...state.logs.filter((l) => l.date !== prevDate), log];
      }
      return {
        ...state,
        logs,
        // reinicia el check de rutinas
        routines: state.routines.map((r) => ({ ...r, completed: false })),
        // descarta tareas sueltas ya completadas, conserva pendientes
        tasks: prevDate && prevDate !== action.today
          ? state.tasks.filter((t) => !t.completed)
          : state.tasks,
        lastActiveDate: action.today,
      };
    }

    case "IMPORT_DATA":
      return { ...state, ...action.payload };

    case "RESET_ALL":
      return { ...initialState, lastActiveDate: localDateStr() };

    default:
      return state;
  }
}

export type SyncStatus = "idle" | "syncing" | "synced" | "error" | "offline";

interface SyncApi {
  enabled: boolean;
  session: Session | null;
  status: SyncStatus;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const StoreContext = createContext<{
  state: State;
  dispatch: React.Dispatch<Action>;
  sync: SyncApi;
} | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<SyncStatus>(supabaseEnabled ? "idle" : "offline");

  const stateRef = useRef(state);
  stateRef.current = state;
  const hydrated = useRef(false);
  const skipPush = useRef(false);
  const pulledUserId = useRef<string | null>(null);

  // Carga desde localStorage al montar + rollover de día
  useEffect(() => {
    const today = localDateStr();
    const saved = localStorage.getItem("organizer-data");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        dispatch({ type: "LOAD", payload: { ...initialState, ...parsed } });
      } catch {}
    }
    dispatch({ type: "ROLLOVER_DAY", today });
    hydrated.current = true;
  }, []);

  // Re-chequea el cambio de día cada minuto (medianoche / sesiones largas)
  useEffect(() => {
    const id = setInterval(() => {
      dispatch({ type: "ROLLOVER_DAY", today: localDateStr() });
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  // Guarda en localStorage ante cualquier cambio (cache offline)
  useEffect(() => {
    localStorage.setItem("organizer-data", JSON.stringify(state));
  }, [state]);

  // --- Supabase Auth ---
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      // Solo cambiamos la referencia de sesión si cambió el usuario.
      // Así evitamos que eventos como TOKEN_REFRESHED o recuperar el foco
      // vuelvan a disparar el pull inicial y sobrescriban el estado local.
      setSession((prev) => (prev?.user?.id === s?.user?.id ? prev : s));
      if (!s) {
        setStatus("idle");
        pulledUserId.current = null;
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // --- Pull inicial al iniciar sesión ---
  useEffect(() => {
    if (!supabase || !session) return;
    // Un solo pull por usuario: si ya lo hicimos, no volvemos a traer datos
    // remotos (evita pisar tareas recién agregadas que aún no se subieron).
    if (pulledUserId.current === session.user.id) return;
    pulledUserId.current = session.user.id;
    let cancelled = false;
    (async () => {
      setStatus("syncing");
      const { data, error } = await supabase
        .from("app_state")
        .select("data")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setStatus("error");
        return;
      }
      if (data?.data) {
        // Hay datos remotos: los traemos y normalizamos el día
        skipPush.current = true;
        dispatch({ type: "IMPORT_DATA", payload: data.data as Partial<State> });
        dispatch({ type: "ROLLOVER_DAY", today: localDateStr() });
        setStatus("synced");
      } else {
        // Primera vez: subimos lo que haya local
        await pushNow(session, stateRef.current);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // --- Push (debounced) ante cambios, si hay sesión ---
  useEffect(() => {
    if (!supabase || !session || !hydrated.current) return;
    if (skipPush.current) {
      skipPush.current = false;
      return;
    }
    const t = setTimeout(() => {
      pushNow(session, stateRef.current);
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, session]);

  async function pushNow(s: Session, data: State) {
    if (!supabase) return;
    setStatus("syncing");
    const { error } = await supabase.from("app_state").upsert({
      user_id: s.user.id,
      data,
      updated_at: new Date().toISOString(),
    });
    setStatus(error ? "error" : "synced");
  }

  const sync: SyncApi = {
    enabled: supabaseEnabled,
    session,
    status,
    async signIn(email, password) {
      if (!supabase) return { error: "Sync no configurado" };
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null };
    },
    async signUp(email, password) {
      if (!supabase) return { error: "Sync no configurado" };
      const { error } = await supabase.auth.signUp({ email, password });
      return { error: error?.message ?? null };
    },
    async signOut() {
      if (!supabase) return;
      await supabase.auth.signOut();
    },
  };

  return (
    <StoreContext.Provider value={{ state, dispatch, sync }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be inside StoreProvider");
  return ctx;
}

export function useSync() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useSync must be inside StoreProvider");
  return ctx.sync;
}
