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

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { error: "Permiso de notificaciones denegado." };

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

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      subscription: json,
      routines: routineSnapshot(routines),
      notify_minutes: opts.notifyMinutes,
      wake_time: opts.wakeTime ?? null,
      morning_motivation: opts.morningMotivation ?? false,
      tz,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );

  return { error: error?.message ?? null };
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
  await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      subscription: json,
      routines: routineSnapshot(routines),
      notify_minutes: opts.notifyMinutes,
      wake_time: opts.wakeTime ?? null,
      morning_motivation: opts.morningMotivation ?? false,
      tz,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );
}

/** Cancela la suscripción push local y la borra de Supabase. */
export async function disablePush(): Promise<void> {
  if (!pushSupported() || !supabase) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.toJSON().endpoint;
  await sub.unsubscribe();
  if (endpoint) await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}
