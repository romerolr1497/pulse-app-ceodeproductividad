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
