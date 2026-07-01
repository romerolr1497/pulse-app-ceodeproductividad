import type { Project } from "./types";

export interface ParsedCommand {
  kind: "task" | "project-task" | "unknown";
  title?: string;
  projectId?: string;
  projectName?: string;
  reply: string;
}

// Quita tildes para comparar de forma flexible
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function capitalize(s: string): string {
  const t = s.trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

/**
 * Entiende frases dictadas o escritas, por ejemplo:
 *  - "agregar tarea pendiente comprar verduras"
 *  - 'agregar tarea pendiente a Bonne Vet "hacer esto con Claude"'
 *  - "anotá llamar al contador"
 * Detecta el proyecto si el nombre aparece en la frase.
 */
export function parseCommand(raw: string, projects: Project[]): ParsedCommand {
  const text = raw.trim();
  if (!text) {
    return { kind: "unknown", reply: "No te escuché, probá de nuevo." };
  }

  const nText = norm(text);

  // ¿Menciona un proyecto existente? (el nombre más largo que matchee gana)
  let matchedProject: Project | undefined;
  for (const p of projects) {
    if (nText.includes(norm(p.name))) {
      if (!matchedProject || p.name.length > matchedProject.name.length) {
        matchedProject = p;
      }
    }
  }

  // 1) Si hay algo entre comillas, ese es el título exacto
  let title = "";
  const quoted = text.match(/["“”'']([^"“”'']+)["“”'']/);
  if (quoted) {
    title = quoted[1].trim();
  } else {
    // 2) Limpiamos palabras de comando y el nombre del proyecto
    let t = text;
    t = t.replace(
      /\b(agregar|agrega|agreg[aá]|añadir|anad[ií]|anota|anot[aá]|nueva|nuevo|crear|cre[aá]|pon[eé]|sum[aá]|guarda|guard[aá]|record[aá]|recordame)\b/gi,
      " "
    );
    t = t.replace(/\b(tarea|tareas|pendiente|pendientes|recordatorio|nota|item|cosa)\b/gi, " ");
    if (matchedProject) {
      const nameRe = new RegExp(
        matchedProject.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "gi"
      );
      t = t.replace(nameRe, " ");
      t = t.replace(/\b(a|al|en|para|proyecto|del|de|el|la)\b/gi, " ");
    }
    title = t.replace(/\s+/g, " ").trim();
  }

  if (!title) {
    return {
      kind: "unknown",
      reply: '¿Qué querés agendar? Ej: "agregar tarea comprar pan".',
    };
  }

  title = capitalize(title);

  if (matchedProject) {
    return {
      kind: "project-task",
      title,
      projectId: matchedProject.id,
      projectName: matchedProject.name,
      reply: `✅ Agregué "${title}" al proyecto ${matchedProject.name}.`,
    };
  }

  return {
    kind: "task",
    title,
    reply: `✅ Agregué "${title}" a pendientes.`,
  };
}
