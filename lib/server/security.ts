const encoder = new TextEncoder();
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = process.env.SITE_URL
    ? new URL(process.env.SITE_URL).origin
    : new URL(request.url).origin;
  if (!origin || origin !== expected)
    throw new HttpError(403, "This action must originate from Rallypoint.");
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export async function readJson(
  request: Request,
  max = 12000,
): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new HttpError(415, "Expected application/json.");
  const raw = await readLimited(request, max);
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) throw new HttpError(400, "Expected a JSON object.");
    return parsed;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "Invalid JSON.");
  }
}
export async function readLimited(
  request: Request,
  max = 65536,
): Promise<string> {
  if (Number(request.headers.get("content-length")) > max)
    throw new HttpError(413, "Request too large.");
  const reader = request.body?.getReader();
  if (!reader) return "";
  let count = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    count += value.byteLength;
    if (count > max) {
      await reader.cancel();
      throw new HttpError(413, "Request too large.");
    }
    chunks.push(value);
  }
  const data = new Uint8Array(count);
  let offset = 0;
  for (const chunk of chunks) {
    data.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(data);
}
export function apiError(error: unknown) {
  const status = error instanceof HttpError ? error.status : 500;
  const message =
    error instanceof Error ? error.message : "Unexpected request failure.";
  return Response.json(
    {
      error:
        status >= 500
          ? "Service temporarily unavailable. Please try again."
          : message,
    },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export function randomToken(size = 32) {
  const b = crypto.getRandomValues(new Uint8Array(size));
  return btoa(String.fromCharCode(...b))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}
export async function sha256(value: string) {
  const b = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(b), (x) =>
    x.toString(16).padStart(2, "0"),
  ).join("");
}
export async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return Array.from(
    new Uint8Array(
      await crypto.subtle.sign("HMAC", key, encoder.encode(value)),
    ),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
}
export function constantEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++)
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
export function cookie(request: Request, key: string) {
  const entry = request.headers
    .get("cookie")
    ?.split(";")
    .find((s) => s.trim().startsWith(key + "="));
  return entry?.trim().slice(key.length + 1);
}
async function aesKey(secret: string) {
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(secret), (c) => c.charCodeAt(0));
  } catch {
    throw new Error("Token encryption key is not valid base64.");
  }
  if (bytes.length !== 32)
    throw new Error("Token encryption key must be 32 bytes.");
  return crypto.subtle.importKey(
    "raw",
    bytes.buffer as ArrayBuffer,
    "AES-GCM",
    false,
    ["encrypt", "decrypt"],
  );
}
export async function encrypt(value: unknown, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      await aesKey(secret),
      encoder.encode(JSON.stringify(value)),
    ),
  );
  return btoa(String.fromCharCode(...iv, ...encrypted));
}
export async function decrypt<T>(value: string, secret: string): Promise<T> {
  const bytes = Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
  const data = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bytes.slice(0, 12) },
    await aesKey(secret),
    bytes.slice(12),
  );
  return JSON.parse(new TextDecoder().decode(data));
}
