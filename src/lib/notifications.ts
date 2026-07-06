"use client";

import type { RoutineBlock } from "./types";

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "Notification" in window;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!notificationsSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    return reg;
  } catch {
    return null;
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return "denied";
  if (Notification.permission === "granted") return "granted";
  try {
    await Notification.requestPermission();
  } catch {
    // Safari antiguo usa callback y la promesa puede rechazar/resolver undefined.
  }
  // Leemos el valor real: algunos navegadores resuelven la promesa con undefined.
  return Notification.permission;
}

function timeToTodayMs(time: string): number {
  const [h, m] = time.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

/** Programa, vía el service worker, las notificaciones de las rutinas de hoy. */
export async function scheduleRoutineNotifications(
  routines: RoutineBlock[],
  minutesBefore = 0
) {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  const reg = await navigator.serviceWorker.ready;
  const offset = minutesBefore * 60 * 1000;
  const items = routines.map((r) => ({
    at: timeToTodayMs(r.startTime) - offset,
    title: "Pulse · " + r.name,
    body:
      minutesBefore > 0
        ? `Arranca en ${minutesBefore} min (${r.startTime})`
        : `Es hora: ${r.startTime} – ${r.endTime}`,
    tag: `routine-${r.id}`,
  }));
  reg.active?.postMessage({ type: "SCHEDULE", items });
}

export async function sendTestNotification() {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  const reg = await navigator.serviceWorker.ready;
  reg.active?.postMessage({ type: "TEST" });
}
