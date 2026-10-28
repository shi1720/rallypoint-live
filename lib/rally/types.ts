export type Choice = { id: string; label: string };
export type Brief = {
  title: string;
  context: string;
  stakes: string;
  action: string;
  choices: Choice[];
  expiresAt: string;
  status: "draft" | "live" | "closed";
  version: number;
  publishedAt: string | null;
};
export type Proposal = {
  id: string;
  author: string;
  text: string;
  sourceId: string;
  createdAt: string;
  status: "pending" | "accepted" | "rejected";
};
export type Contribution = {
  id: string;
  userId: string;
  name: string;
  choiceId: string;
  version: number;
  at: string;
  raidId: string | null;
};
export type Raid = {
  id: string;
  from: string;
  viewers: number;
  at: string;
  welcomeUntil: string;
};
export type Activity = {
  id: string;
  kind: string;
  title: string;
  detail: string;
  at: string;
};
export type RallyState = {
  publicMetrics?: {
    currentContributors: number;
    counts: Record<string, number>;
    raidWindowContributors: number;
    totalContributors: number;
  };
  id: string;
  publicId: string;
  channel: string;
  creator: string;
  sessionTitle: string;
  brief: Brief;
  proposals: Proposal[];
  contributions: Contribution[];
  raids: Raid[];
  activity: Activity[];
  processedIds: string[];
  cooldowns: Record<string, number>;
  opens: number;
  createdAt: string;
  updatedAt: string;
  revision: number;
};
export type Action =
  | {
      type: "publish";
      brief: Pick<
        Brief,
        "title" | "context" | "stakes" | "action" | "choices" | "expiresAt"
      >;
      expectedVersion?: number;
    }
  | { type: "close" }
  | { type: "review"; proposalId: string; decision: "accepted" | "rejected" }
  | {
      type: "chat";
      messageId: string;
      userId: string;
      name: string;
      text: string;
      at?: string;
    }
  | {
      type: "raid";
      eventId: string;
      from: string;
      viewers: number;
      at?: string;
    }
  | { type: "open" }
  | { type: "settings"; channel: string; sessionTitle: string }
  | { type: "reset" };
export type Transition = {
  state: RallyState;
  reply?: string;
  changed: boolean;
};
export type Connection = {
  configured: boolean;
  connected: boolean;
  channel?: string;
  broadcasterId?: string;
  scopes?: string[];
  updatedAt?: string;
  error?: string;
  callbackUrl?: string;
  clientIdConfigured?: boolean;
  webhookStatus?: string;
};
export type RoomResponse = {
  state: RallyState;
  connection: Connection;
  user: { name: string };
  publicUrl: string;
  overlayUrl: string;
};
