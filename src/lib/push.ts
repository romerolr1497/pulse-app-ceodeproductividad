"use client";

import { supabase } from "./supabase";
import type { RoutineBlock } from "./types";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const arr = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function routineSnapshot(routines: RoutineBlock[]) {
  return routines.map((r) => ({ id: r.id, name: r.name, startTime: r.startTime, days: r.days ?? null }));
}

// Access token de la sesión actual (para autenticar contra el endpoint server).
async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export interface PushOpts {
  notifyMinutes: number;
  wakeTime?: string;
  morningMotivation?: boolean;
}

/**
 * Pide permiso, crea la suscripción push y la guarda en Supabase.
 * Devuelve { error } (null si todo ok). Requiere sesión iniciada.
 */
export async function enablePush(
  userId: string,
  routines: RoutineBlock[],
  opts: PushOpts
): Promise<{ error: string | null }> {
  if (!pushSupported()) return { error: "Tu navegador no soporta notificaciones push." };
  if (!VAPID_PUBLIC) return { error: "Push no configurado (falta VAPID)." };
  if (!supabase) return { error: "Necesitás iniciar sesión para activar las notificaciones." };

  // Pedimos permiso solo si hace falta y comprobamos el valor REAL de
  // Notification.permission (algunos navegadores resuelven la promesa con undefined).
  if (Notification.permission !== "granted") {
    try {
      await Notification.requestPermission();
    } catch {}
  }
  if (Notification.permission !== "granted") {
    return { error: "Permiso de notificaciones denegado." };
  }

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
    });
  }

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Argentina/Buenos_Aires";
  const json = sub.toJSON();

  // Se guarda en el servidor (service_role) porque la tabla tiene RLS activo.
  const accessToken = await getAccessToken();
  if (!accessToken) return { error: "Necesitás iniciar sesión para activar las notificaciones." };

  try {
    const res = await fetch("/api/push/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accessToken,
        subscription: json,
        routines: routineSnapshot(routines),
        notifyMinutes: opts.notifyMinutes,
        wakeTime: opts.wakeTime ?? null,
        morningMotivation: opts.morningMotivation ?? false,
        tz,
      }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return { error: data.error ?? `Error ${res.status} al registrar en la nube.` };
    }
  } catch {
    return { error: "No hay conexión para registrar en la nube." };
  }

  return { error: null };
}

/** Actualiza el snapshot de rutinas/anticipación de la suscripción actual (si existe). */
export async function syncPushRoutines(
  userId: string,
  routines: RoutineBlock[],
  opts: PushOpts
): Promise<void> {
  if (!pushSupported() || !supabase) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const json = sub.toJSON();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Argentina/Buenos_Aires";
  const accessToken = await getAccessToken();
  if (!accessToken) return;
  try {
    await fetch("/api/push/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accessToken,
        subscription: json,
        routines: routineSnapshot(routines),
        notifyMinutes: opts.notifyMinutes,
        wakeTime: opts.wakeTime ?? null,
        morningMotivation: opts.morningMotivation ?? false,
        tz,
      }),
    });
  } catch {}
}

/** Cancela la suscripción push local y la borra de Supabase. */
export async function disablePush(): Promise<void> {
  if (!pushSupported() || !supabase) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.toJSON().endpoint;
  await sub.unsubscribe();
  const accessToken = await getAccessToken();
  if (endpoint && accessToken) {
    try {
      await fetch("/api/push/register", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken, endpoint }),
      });
    } catch {}
  }
}

export interface PushCloudStatus {
  supported: boolean;
  permission: NotificationPermission | "unsupported";
  hasLocalSub: boolean;
  registeredInCloud: boolean;
  standalone: boolean; // PWA instalada (necesario en iOS)
}

/** Diagnóstico completo del estado de las notificaciones push. */
export async function getPushStatus(userId: string | null): Promise<PushCloudStatus> {
  const supported = pushSupported();
  const standalone =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true);

  if (!supported) {
    return {
      supported: false,
      permission: "unsupported",
      hasLocalSub: false,
      registeredInCloud: false,
      standalone: !!standalone,
    };
  }

  const permission = Notification.permission;
  let hasLocalSub = false;
  let endpoint: string | undefined;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    hasLocalSub = !!sub;
    endpoint = sub?.toJSON().endpoint;
  } catch {}

  let registeredInCloud = false;
  if (userId && endpoint && supabase) {
    const accessToken = await getAccessToken();
    if (accessToken) {
      try {
        const res = await fetch(`/api/push/register?endpoint=${encodeURIComponent(endpoint)}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.ok) {
          const data = (await res.json()) as { registered?: boolean };
          registeredInCloud = !!data.registered;
        }
      } catch {}
    }
  }

  return {
    supported: true,
    permission,
    hasLocalSub,
    registeredInCloud,
    standalone: !!standalone,
  };
}

/**
 * Envía una notificación push REAL desde el servidor a este dispositivo.
 * Prueba la cadena completa (a diferencia de la prueba local en primer plano).
 */
export async function sendServerTestPush(): Promise<{ error: string | null }> {
  if (!pushSupported()) return { error: "Tu navegador no soporta push." };
  if (Notification.permission !== "granted")
    return { error: "Primero activá las notificaciones (permiso)." };
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    if (!VAPID_PUBLIC) return { error: "Push no configurado (VAPID)." };
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      });
    } catch {
      return { error: "No se pudo crear la suscripción push." };
    }
  }

  try {
    const res = await fetch("/api/push/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { error: (data as { error?: string }).error ?? `Error ${res.status}` };
    }
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error de red." };
  }
}
