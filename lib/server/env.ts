export type RallyEnv = {
  GOOGLE_CLOUD_PROJECT?: string;
  FIRESTORE_DATABASE_ID?: string;
  FIREBASE_WEB_CONFIG?: string;
  TWITCH_CLIENT_ID?: string;
  TWITCH_CLIENT_SECRET?: string;
  TWITCH_WEBHOOK_SECRET?: string;
  TOKEN_ENCRYPTION_KEY?: string;
  SITE_URL?: string;
  CLOUD_TASKS_QUEUE?: string;
  CLOUD_TASKS_LOCATION?: string;
};
export function runtime(): RallyEnv {
  return process.env as RallyEnv;
}
export function siteOrigin(request: Request): string {
  const configured = runtime().SITE_URL;
  if (configured) return new URL(configured).origin;
  return new URL(request.url).origin;
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
