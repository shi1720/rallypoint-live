declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    TWITCH_CLIENT_ID?: string;
    TWITCH_CLIENT_SECRET?: string;
    TWITCH_WEBHOOK_SECRET?: string;
    TOKEN_ENCRYPTION_KEY?: string;
    SITE_URL?: string;
    BUCKET?: R2Bucket;
  }
}
