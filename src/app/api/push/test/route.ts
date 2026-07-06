import { NextResponse } from "next/server";
import webpush from "web-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Prueba de push REAL: el cliente manda su propia suscripción y el servidor
// le envía una notificación por la cadena completa (VAPID → push service → SW).
// Sirve para diagnosticar si los avisos "con la app cerrada" funcionan.
export async function POST(req: Request) {
  const log = (msg: string, extra?: unknown) =>
    console.log(`[push-test] ${msg}`, extra !== undefined ? JSON.stringify(extra) : "");

  if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    log("missing vapid config");
    return NextResponse.json({ error: "Push no configurado en el servidor (VAPID)." }, { status: 500 });
  }

  let body: { subscription?: webpush.PushSubscription };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const subscription = body.subscription;
  if (!subscription || !subscription.endpoint) {
    log("no subscription in body");
    return NextResponse.json({ error: "Falta la suscripción push." }, { status: 400 });
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@pulse.app",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  const payload = JSON.stringify({
    title: "Pulse · Prueba real ✅",
    body: "Si ves esto, los avisos con la app cerrada funcionan.",
    url: "/",
    tag: "pulse-test-real",
  });

  try {
    await webpush.sendNotification(subscription, payload);
    log("sent ok", { endpoint: subscription.endpoint.slice(0, 40) });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const status = (err as { statusCode?: number })?.statusCode;
    const message = err instanceof Error ? err.message : "error";
    log("send failed", { status, message });
    return NextResponse.json(
      { error: `Falló el envío (código ${status ?? "?"}): ${message}` },
      { status: 502 }
    );
  }
}
