export interface RoutineBlock {
  id: string;
  name: string;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  color: string;
  completed?: boolean;
  days?: number[]; // días activos 0=dom..6=sáb; undefined = todos
}

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  priority: 1 | 2 | 3;
  project?: string;
  createdAt: string;
  completedAt?: string;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  tasks: Task[];
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm (opcional: evento sin hora = todo el día)
  endTime?: string; // HH:mm opcional
  notes?: string;
  color?: string;
  notifyMinutes?: number; // aviso X min antes (undefined = sin aviso)
  completed?: boolean;
}

// Rutina flexible: hábito sin hora ni día fijo (ej: deporte). Se completa
// "cuando la hago" y cada día completado suma a las estadísticas.
export interface FlexRoutine {
  id: string;
  name: string;
  color: string;
  completedDates: string[]; // fechas YYYY-MM-DD en que se marcó como hecha
}

// Reserva: bloque de tiempo con prioridad pero solapable. No es tarea ni
// evento fijo; puede pisarse con un turno/evento si surge algo.
export interface Reservation {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime?: string; // HH:mm opcional
  notes?: string;
  color?: string;
  notifyMinutes?: number; // aviso X min antes de startTime (undefined = sin aviso)
}

export interface DayLog {
  date: string; // YYYY-MM-DD
  routinesCompleted: number;
  routinesTotal: number;
  tasksCompleted: number;
  tasksTotal: number;
}

export interface AppSettings {
  notifications: boolean;
  notifyMinutesBefore: number; // minutos de anticipación del aviso
  wakeTime?: string; // HH:mm — hora en que te levantás (buenos días)
  morningMotivation?: boolean; // enviar frase motivacional al despertar
}
