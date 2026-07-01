"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import {
  registerServiceWorker,
  scheduleRoutineNotifications,
  notificationsSupported,
} from "@/lib/notifications";

/** Registra el service worker y reprograma los avisos de rutina
 * cada vez que cambian las rutinas o la configuración. */
export function NotificationScheduler() {
  const { state } = useStore();

  useEffect(() => {
    if (notificationsSupported()) registerServiceWorker();
  }, []);

  useEffect(() => {
    if (!state.settings.notifications) return;
    scheduleRoutineNotifications(state.routines, state.settings.notifyMinutesBefore);
    // Reprograma al cruzar la medianoche / cada 30 min por las dudas
    const id = setInterval(() => {
      scheduleRoutineNotifications(state.routines, state.settings.notifyMinutesBefore);
    }, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [state.routines, state.settings.notifications, state.settings.notifyMinutesBefore]);

  return null;
}
