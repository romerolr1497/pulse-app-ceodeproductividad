import crypto from "crypto";

export interface ActionTokenPayload {
  u: string; // userId
  r: string; // routineId
  d: string; // fecha local del usuario YYYY-MM-DD
  exp: number; // epoch segundos
}

export function signActionToken(p: ActionTokenPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(p)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyActionToken(token: string, secret: string): ActionTokenPayload | null {
  try {
    const [body, sig] = token.split(".");
    if (!body || !sig) return null;
    const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as ActionTokenPayload;
    if (typeof p.exp !== "number" || p.exp < Math.floor(Date.now() / 1000)) return null;
    return p;
  } catch {
    return null;
  }
}
