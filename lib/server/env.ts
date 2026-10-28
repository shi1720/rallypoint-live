import { env } from "cloudflare:workers";
export type RallyEnv = Cloudflare.Env & {
  DB: D1Database;
  TWITCH_CLIENT_ID?: string;
  TWITCH_CLIENT_SECRET?: string;
  TWITCH_WEBHOOK_SECRET?: string;
  TOKEN_ENCRYPTION_KEY?: string;
  SITE_URL?: string;
};
export function runtime(): RallyEnv {
  if (!env.DB)
    throw new Error(
      "Database unavailable. Apply the documented D1 migrations.",
    );
  return env as RallyEnv;
}
export function siteOrigin(request: Request): string {
  const configured = runtime().SITE_URL;
  return configured ? new URL(configured).origin : new URL(request.url).origin;
}
export function configured(): boolean {
  const e = runtime();
  return !!(
    e.TWITCH_CLIENT_ID &&
    e.TWITCH_CLIENT_SECRET &&
    e.TWITCH_WEBHOOK_SECRET &&
    e.TOKEN_ENCRYPTION_KEY
  );
}
