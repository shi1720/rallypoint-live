import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
export const rooms = sqliteTable("rooms", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().unique(),
  publicId: text("public_id").notNull().unique(),
  revision: integer("revision").notNull().default(0),
  state: text("state").notNull(),
  updatedAt: text("updated_at").notNull(),
});
export const integrations = sqliteTable("integrations", {
  ownerId: text("owner_id").primaryKey(),
  broadcasterId: text("broadcaster_id").notNull().unique(),
  channel: text("channel").notNull(),
  encryptedTokens: text("encrypted_tokens").notNull(),
  scopes: text("scopes").notNull(),
  subscriptionIds: text("subscription_ids").notNull().default("[]"),
  status: text("status").notNull(),
  error: text("error"),
  updatedAt: text("updated_at").notNull(),
});
export const oauthStates = sqliteTable(
  "oauth_states",
  {
    hash: text("hash").primaryKey(),
    ownerId: text("owner_id").notNull(),
    expiresAt: integer("expires_at").notNull(),
  },
  (t) => [index("oauth_expiry").on(t.expiresAt)],
);
export const outbox = sqliteTable(
  "outbox",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    reply: text("reply").notNull(),
    parentId: text("parent_id"),
    status: text("status").notNull().default("pending"),
    createdAt: text("created_at").notNull(),
    error: text("error"),
  },
  (t) => [index("outbox_owner").on(t.ownerId)],
);

export const eventReceipts = sqliteTable(
  "event_receipts",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    receivedAt: integer("received_at").notNull(),
  },
  (t) => [index("event_receipts_age").on(t.receivedAt)],
);
