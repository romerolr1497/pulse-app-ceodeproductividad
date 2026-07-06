"use client";

import { useEffect, useState, useRef } from "react";
import { Bell, Palette, Database, CalendarClock, Download, Upload, Trash2, Cloud } from "lucide-react";
import { useStore, useSync } from "@/lib/store";
import { RoutineManager } from "@/components/RoutineManager";
import { AccountSync } from "@/components/AccountSync";
import {
  enablePush,
  disablePush,
  syncPushRoutines,
  getPushStatus,
  sendServerTestPush,
  type PushCloudStatus,
} from "@/lib/push";
import {
  requestNotificationPermission,
  registerServiceWorker,
  sendTestNotification,
  scheduleRoutineNotifications,
  notificationsSupported,
} from "@/lib/notifications";

function StatusRow({ label, ok, text, warn }: { label: string; ok: boolean; text: string; warn?: boolean }) {
  const color = ok ? "var(--success)" : warn ? "var(--accent)" : "var(--danger)";
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-[var(--text-secondary)]">{label}</span>
      <span className="flex items-center gap-1.5 font-medium" style={{ color }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
        {text}
      </span>
    </div>
  );
}

export default function SettingsPage() {
  const { state, dispatch } = useStore();
  const sync = useSync();
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState<string | null>(null);
  const [testBusy, setTestBusy] = useState(false);
  const [cloud, setCloud] = useState<PushCloudStatus | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refreshCloud = async () => {
    setCloud(await getPushStatus(sync.session?.user.id ?? null));
  };

  useEffect(() => {
    if (!notificationsSupported()) setPerm("unsupported");
    else setPerm(Notification.permission);
  }, []);

  // Carga el diagnóstico de push cuando cambia la sesión o el estado de notifs.
  useEffect(() => {
    refreshCloud();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sync.session, state.settings.notifications]);

  // Mantener el snapshot de rutinas/anticipación al día en el servidor push.
  useEffect(() => {
    if (!state.settings.notifications || !sync.session) return;
    syncPushRoutines(sync.session.user.id, state.routines, {
      notifyMinutes: state.settings.notifyMinutesBefore,
      wakeTime: state.settings.wakeTime,
      morningMotivation: state.settings.morningMotivation,
    });
  }, [
    state.routines,
    state.settings.notifyMinutesBefore,
    state.settings.wakeTime,
    state.settings.morningMotivation,
    state.settings.notifications,
    sync.session,
  ]);

  async function toggleNotifications() {
    if (state.settings.notifications) {
      dispatch({ type: "UPDATE_SETTINGS", settings: { notifications: false } });
      setPushMsg(null);
      await disablePush();
      return;
    }
    setPushBusy(true);
    setPushMsg(null);
    await registerServiceWorker();
    const result = await requestNotificationPermission();
    setPerm(result);
    if (result === "granted") {
      dispatch({ type: "UPDATE_SETTINGS", settings: { notifications: true } });
      await scheduleRoutineNotifications(state.routines, state.settings.notifyMinutesBefore);
      if (sync.session) {
        const { error } = await enablePush(sync.session.user.id, state.routines, {
          notifyMinutes: state.settings.notifyMinutesBefore,
          wakeTime: state.settings.wakeTime,
          morningMotivation: state.settings.morningMotivation,
        });
        setPushMsg(
          error
            ? `Avisos locales activos. Push en la nube: ${error}`
            : "Listo: vas a recibir avisos aunque la app esté cerrada."
        );
      } else {
        setPushMsg("Avisos locales activos. Iniciá sesión arriba para recibirlos con la app cerrada.");
      }
      await refreshCloud();
    }
    setPushBusy(false);
  }

  // Fuerza el registro (o re-registro) de la suscripción en la nube.
  async function registerInCloud() {
    if (!sync.session) {
      setPushMsg("Iniciá sesión arriba para registrar los avisos en la nube.");
      return;
    }
    setPushBusy(true);
    setPushMsg(null);
    await registerServiceWorker();
    const permRes = await requestNotificationPermission();
    setPerm(permRes);
    if (permRes !== "granted") {
      setPushMsg("Permiso de notificaciones denegado.");
      setPushBusy(false);
      return;
    }
    const { error } = await enablePush(sync.session.user.id, state.routines, {
      notifyMinutes: state.settings.notifyMinutesBefore,
      wakeTime: state.settings.wakeTime,
      morningMotivation: state.settings.morningMotivation,
    });
    setPushMsg(error ? `No se pudo registrar: ${error}` : "Registrado en la nube ✅");
    await refreshCloud();
    setPushBusy(false);
  }

  // Prueba de push real (desde el servidor, cadena completa).
  async function testRealPush() {
    setTestBusy(true);
    setPushMsg(null);
    const { error } = await sendServerTestPush();
    setPushMsg(
      error
        ? `Prueba real falló: ${error}`
        : "Prueba real enviada. Debería llegarte en unos segundos (probá con la app en segundo plano)."
    );
    setTestBusy(false);
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pulse-backup-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importData(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        dispatch({ type: "IMPORT_DATA", payload: parsed });
        alert("Datos importados correctamente.");
      } catch {
        alert("Archivo inválido.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <div className="p-4 lg:p-6 xl:p-8 max-w-3xl mx-auto">
      <header className="mb-5 lg:mb-6">
        <p className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-widest">System</p>
        <h1 className="font-heading text-xl lg:text-2xl font-bold text-[var(--text-primary)] tracking-tight mt-0.5">
          Configuración
        </h1>
      </header>

      <div className="space-y-3">
        {/* Cuenta y sync */}
        <SettingSection icon={Cloud} title="Cuenta y sync" description="Sincronizá tus datos entre dispositivos">
          <AccountSync />
        </SettingSection>

        {/* Rutinas */}
        <SettingSection icon={CalendarClock} title="Rutina diaria" description="Editá tus bloques, horarios y colores">
          <RoutineManager />
        </SettingSection>

        {/* Notificaciones */}
        <SettingSection icon={Bell} title="Notificaciones" description="Avisos para el inicio de cada bloque">
          {perm === "unsupported" ? (
            <p className="text-[11px] text-[var(--text-tertiary)] italic">
              Tu navegador no soporta notificaciones. En iPhone, instalá Pulse en la pantalla de inicio (iOS 16.4+).
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-[var(--text-secondary)]">
                  {state.settings.notifications ? "Activadas" : "Desactivadas"}
                  {perm === "denied" && " · permiso bloqueado en el navegador"}
                </span>
                <button
                  onClick={toggleNotifications}
                  disabled={pushBusy}
                  className={`relative w-11 h-6 rounded-full transition disabled:opacity-50 ${
                    state.settings.notifications ? "bg-[var(--accent)]" : "bg-white/[0.1]"
                  }`}
                  aria-label="Activar notificaciones"
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
                      state.settings.notifications ? "left-[22px]" : "left-0.5"
                    }`}
                  />
                </button>
              </div>

              {state.settings.notifications && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-[var(--text-secondary)]">Avisar con anticipación</span>
                    <select
                      value={state.settings.notifyMinutesBefore}
                      onChange={(e) =>
                        dispatch({ type: "UPDATE_SETTINGS", settings: { notifyMinutesBefore: Number(e.target.value) } })
                      }
                      className="bg-white/[0.04] border border-[var(--border)] rounded-lg px-2 py-1 text-[12px] text-[var(--text-primary)] outline-none [color-scheme:dark]"
                    >
                      <option value={0}>En el momento</option>
                      <option value={5}>5 min antes</option>
                      <option value={10}>10 min antes</option>
                      <option value={15}>15 min antes</option>
                    </select>
                  </div>

                  <div className="h-px bg-[var(--border)] my-1" />

                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[12px] text-[var(--text-secondary)] block">Buenos días motivacional</span>
                      <span className="text-[10px] text-[var(--text-tertiary)]">Frase estoica al despertar</span>
                    </div>
                    <button
                      onClick={() =>
                        dispatch({
                          type: "UPDATE_SETTINGS",
                          settings: { morningMotivation: !state.settings.morningMotivation },
                        })
                      }
                      className={`relative w-11 h-6 rounded-full transition shrink-0 ${
                        state.settings.morningMotivation ? "bg-[var(--accent)]" : "bg-white/[0.1]"
                      }`}
                      aria-label="Buenos días motivacional"
                    >
                      <span
                        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
                          state.settings.morningMotivation ? "left-[22px]" : "left-0.5"
                        }`}
                      />
                    </button>
                  </div>

                  {state.settings.morningMotivation && (
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-[var(--text-secondary)]">Hora en que te levantás</span>
                      <input
                        type="time"
                        value={state.settings.wakeTime ?? "07:00"}
                        onChange={(e) =>
                          dispatch({ type: "UPDATE_SETTINGS", settings: { wakeTime: e.target.value } })
                        }
                        className="bg-white/[0.04] border border-[var(--border)] rounded-lg px-2 py-1 text-[12px] text-[var(--text-primary)] outline-none [color-scheme:dark]"
                      />
                    </div>
                  )}

                  <div className="h-px bg-[var(--border)] my-1" />

                  {/* Panel de diagnóstico */}
                  <div className="rounded-lg bg-white/[0.02] border border-[var(--border)] p-3 space-y-1.5">
                    <p className="text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                      Estado de los avisos
                    </p>
                    <StatusRow label="Permiso del navegador" ok={perm === "granted"} text={perm === "granted" ? "concedido" : perm === "denied" ? "bloqueado" : "sin conceder"} />
                    <StatusRow label="Sesión iniciada" ok={!!sync.session} text={sync.session ? "sí" : "no — iniciá sesión arriba"} />
                    <StatusRow label="Registrado en la nube" ok={!!cloud?.registeredInCloud} text={cloud?.registeredInCloud ? "sí" : "no"} />
                    {cloud && !cloud.standalone && (
                      <StatusRow label="App instalada (iPhone)" ok={false} text="recomendado en iOS" warn />
                    )}
                  </div>

                  {!cloud?.registeredInCloud && sync.session && (
                    <p className="text-[10px] text-[var(--accent)] leading-relaxed">
                      Tus avisos no están registrados en la nube. Tocá “Registrar en la nube” para recibirlos con la app cerrada.
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2 pt-0.5">
                    <button
                      onClick={registerInCloud}
                      disabled={pushBusy}
                      className="px-3 py-1.5 bg-[var(--accent)] text-black text-[11px] font-medium rounded-lg hover:bg-[var(--accent-muted)] transition disabled:opacity-50"
                    >
                      {pushBusy ? "Registrando…" : "Registrar en la nube"}
                    </button>
                    <button
                      onClick={testRealPush}
                      disabled={testBusy}
                      className="px-3 py-1.5 bg-white/[0.04] text-[var(--text-secondary)] text-[11px] font-medium rounded-lg hover:bg-white/[0.08] transition disabled:opacity-50"
                    >
                      {testBusy ? "Enviando…" : "Probar aviso real (nube)"}
                    </button>
                    <button
                      onClick={sendTestNotification}
                      className="px-3 py-1.5 bg-white/[0.04] text-[var(--text-tertiary)] text-[11px] font-medium rounded-lg hover:bg-white/[0.08] transition"
                    >
                      Prueba local
                    </button>
                  </div>

                  {pushMsg && (
                    <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">{pushMsg}</p>
                  )}
                  <p className="text-[10px] text-[var(--text-tertiary)] leading-relaxed">
                    “Prueba local” abre un aviso al toque (app abierta). “Prueba real (nube)” lo manda desde el
                    servidor: si te llega con la app en segundo plano, todo funciona. En iPhone instalá Pulse en la
                    pantalla de inicio (iOS 16.4+).
                  </p>
                </>
              )}
            </div>
          )}
        </SettingSection>

        {/* Apariencia */}
        <SettingSection icon={Palette} title="Apariencia" description="Tema y personalización visual">
          <p className="text-[11px] text-[var(--text-tertiary)] italic">Tema oscuro activo</p>
        </SettingSection>

        {/* Datos */}
        <SettingSection icon={Database} title="Datos" description="Respaldá, restaurá o limpiá tus datos">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={exportData}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.04] text-[var(--text-secondary)] text-[11px] font-medium rounded-lg hover:bg-white/[0.08] transition"
            >
              <Download className="w-3.5 h-3.5" /> Exportar
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.04] text-[var(--text-secondary)] text-[11px] font-medium rounded-lg hover:bg-white/[0.08] transition"
            >
              <Upload className="w-3.5 h-3.5" /> Importar
            </button>
            <input ref={fileRef} type="file" accept="application/json" onChange={importData} className="hidden" />
            <button
              onClick={() => {
                if (confirm("¿Seguro? Esto borra todos los datos locales.")) {
                  dispatch({ type: "RESET_ALL" });
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--danger)]/10 text-[var(--danger)] text-[11px] font-medium rounded-lg hover:bg-[var(--danger)]/20 transition"
            >
              <Trash2 className="w-3.5 h-3.5" /> Resetear
            </button>
          </div>
        </SettingSection>
      </div>
    </div>
  );
}

function SettingSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-start gap-4">
        <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-[var(--text-secondary)]" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[13px] font-medium text-[var(--text-primary)]">{title}</h3>
          <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5 mb-3">{description}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
