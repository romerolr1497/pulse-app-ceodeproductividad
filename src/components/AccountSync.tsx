"use client";

import { useState } from "react";
import { useSync } from "@/lib/store";
import { Cloud, CloudOff, LogOut, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export function AccountSync() {
  const sync = useSync();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (!sync.enabled) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-white/[0.01] p-4">
        <CloudOff className="w-4 h-4 text-[var(--text-tertiary)] mt-0.5 shrink-0" />
        <div>
          <p className="text-[13px] text-[var(--text-secondary)]">Sync en la nube no configurado</p>
          <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
            Faltan las variables de entorno de Supabase. Tus datos se guardan solo en este dispositivo.
          </p>
        </div>
      </div>
    );
  }

  // Sesión activa
  if (sync.session) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-xl border border-[var(--accent)]/25 bg-[var(--accent-subtle)] p-4">
          <div className="flex items-center gap-3 min-w-0">
            <Cloud className="w-4 h-4 text-[var(--accent)] shrink-0" />
            <div className="min-w-0">
              <p className="text-[13px] text-[var(--text-primary)] truncate">{sync.session.user.email}</p>
              <p className="text-[11px] text-[var(--text-tertiary)] flex items-center gap-1">
                <SyncBadge status={sync.status} />
              </p>
            </div>
          </div>
          <button
            onClick={() => sync.signOut()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] text-[var(--text-secondary)] text-[12px] hover:bg-white/[0.08] transition shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" /> Salir
          </button>
        </div>
        <p className="text-[11px] text-[var(--text-tertiary)]">
          Tus datos se sincronizan automáticamente en todos tus dispositivos.
        </p>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!email.trim() || !password) return;
    setBusy(true);
    const fn = mode === "signin" ? sync.signIn : sync.signUp;
    const { error } = await fn(email.trim(), password);
    setBusy(false);
    if (error) {
      setError(error);
    } else if (mode === "signup") {
      setInfo("Cuenta creada. Si pide confirmación, revisá tu email; si no, ya podés iniciar sesión.");
      setMode("signin");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Cloud className="w-4 h-4 text-[var(--text-tertiary)]" />
        <p className="text-[13px] text-[var(--text-secondary)]">
          {mode === "signin" ? "Iniciá sesión para sincronizar" : "Creá tu cuenta"}
        </p>
      </div>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="tu@email.com"
        autoComplete="email"
        className="w-full bg-white/[0.03] border border-[var(--border)] rounded-lg px-3 py-2.5 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]/30 transition"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Contraseña"
        autoComplete={mode === "signin" ? "current-password" : "new-password"}
        className="w-full bg-white/[0.03] border border-[var(--border)] rounded-lg px-3 py-2.5 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]/30 transition"
      />

      {error && (
        <p className="flex items-center gap-1.5 text-[11px] text-[var(--danger)]">
          <AlertCircle className="w-3.5 h-3.5" /> {error}
        </p>
      )}
      {info && (
        <p className="flex items-center gap-1.5 text-[11px] text-[var(--success)]">
          <CheckCircle2 className="w-3.5 h-3.5" /> {info}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--accent)] text-black text-[13px] font-semibold hover:bg-[var(--accent-muted)] transition disabled:opacity-50"
      >
        {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {mode === "signin" ? "Iniciar sesión" : "Crear cuenta"}
      </button>

      <button
        type="button"
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setError(null);
          setInfo(null);
        }}
        className="w-full text-center text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition"
      >
        {mode === "signin" ? "¿No tenés cuenta? Registrate" : "¿Ya tenés cuenta? Iniciá sesión"}
      </button>
    </form>
  );
}

function SyncBadge({ status }: { status: string }) {
  if (status === "syncing")
    return (
      <span className="flex items-center gap-1 text-[var(--text-tertiary)]">
        <Loader2 className="w-3 h-3 animate-spin" /> Sincronizando…
      </span>
    );
  if (status === "synced")
    return (
      <span className="flex items-center gap-1 text-[var(--success)]">
        <CheckCircle2 className="w-3 h-3" /> Sincronizado
      </span>
    );
  if (status === "error")
    return (
      <span className="flex items-center gap-1 text-[var(--danger)]">
        <AlertCircle className="w-3 h-3" /> Error de sync
      </span>
    );
  return <span className="text-[var(--text-tertiary)]">Conectado</span>;
}
