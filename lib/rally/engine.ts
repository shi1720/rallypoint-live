import type { Action, Activity, Brief, RallyState, Transition } from "./types";

const LIMITS = {
  messages: 2000,
  contributions: 5000,
  proposals: 200,
  raids: 50,
  activity: 120,
  cooldowns: 4000,
};
const DAY = 86_400_000;
const NO_ACTION =
  "There is no active participation brief right now. The streamer will publish the next chapter soon.";

function time(value?: string): { iso: string; ms: number } {
  const ms = value === undefined ? Date.now() : Date.parse(value);
  if (!Number.isFinite(ms)) throw new Error("A valid timestamp is required.");
  return { iso: new Date(ms).toISOString(), ms };
}
function text(value: unknown, label: string, max: number, min = 1): string {
  if (typeof value !== "string") throw new Error(`${label} must be text.`);
  const cleaned = value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim();
  if (cleaned.length < min || cleaned.length > max)
    throw new Error(`${label} must contain ${min}–${max} characters.`);
  return cleaned;
}
function id(value: unknown, label: string): string {
  return text(value, label, 200);
}
function channel(value: unknown): string {
  const result = text(value, "Channel", 25).toLowerCase().replace(/^#/, "");
  if (!/^[a-z0-9_]{2,25}$/.test(result))
    throw new Error(
      "Use a Twitch channel name with 2–25 letters, numbers or underscores.",
    );
  return result;
}
function uuid(): string {
  return globalThis.crypto.randomUUID();
}
function addActivity(
  state: RallyState,
  kind: string,
  title: string,
  detail: string,
  at: string,
) {
  const activity: Activity = { id: uuid(), kind, title, detail, at };
  state.activity = [activity, ...state.activity].slice(0, LIMITS.activity);
}
function remember(state: RallyState, eventId: string): boolean {
  if (state.processedIds.includes(eventId)) return false;
  state.processedIds = [...state.processedIds, eventId].slice(-LIMITS.messages);
  return true;
}
function cooldown(
  state: RallyState,
  key: string,
  ms: number,
  wait: number,
): boolean {
  const previous = state.cooldowns[key];
  if (previous !== undefined && ms - previous < wait) return false;
  state.cooldowns[key] = ms;
  return true;
}
function active(state: RallyState, ms: number): boolean {
  return (
    state.brief.status === "live" && Date.parse(state.brief.expiresAt) > ms
  );
}
function validateBrief(
  value: unknown,
  ms: number,
): Pick<
  Brief,
  "title" | "context" | "stakes" | "action" | "choices" | "expiresAt"
> {
  if (!value || typeof value !== "object")
    throw new Error("A participation brief is required.");
  const candidate = value as Record<string, unknown>;
  if (
    !Array.isArray(candidate.choices) ||
    candidate.choices.length < 2 ||
    candidate.choices.length > 4
  )
    throw new Error("Provide between two and four choices.");
  const choices = candidate.choices.map((choice: unknown) => {
    if (!choice || typeof choice !== "object")
      throw new Error("Each choice needs an ID and label.");
    const row = choice as Record<string, unknown>;
    const choiceId = text(row.id, "Choice ID", 8).toUpperCase();
    if (!/^[A-Z0-9]{1,8}$/.test(choiceId))
      throw new Error("Choice IDs may contain only letters and numbers.");
    return { id: choiceId, label: text(row.label, "Choice label", 70) };
  });
  if (new Set(choices.map((choice) => choice.id)).size !== choices.length)
    throw new Error("Choice IDs must be unique.");
  if (typeof candidate.expiresAt !== "string")
    throw new Error("Choose when the brief expires.");
  const expires = time(candidate.expiresAt);
  if (expires.ms <= ms || expires.ms > ms + DAY)
    throw new Error("The brief must expire in the next 24 hours.");
  return {
    title: text(candidate.title, "Goal", 100),
    context: text(candidate.context, "Context", 280),
    stakes: text(candidate.stakes, "Stakes", 180),
    action: text(candidate.action, "Action", 140),
    choices,
    expiresAt: expires.iso,
  };
}

export function createState(
  options: {
    id?: string;
    publicId?: string;
    channel?: string;
    creator?: string;
  } = {},
  now?: string,
): RallyState {
  const at = time(now);
  return {
    id: options.id ? id(options.id, "Workspace ID") : uuid(),
    publicId: options.publicId ? id(options.publicId, "Public ID") : uuid(),
    channel: options.channel ? channel(options.channel) : "",
    creator: options.creator
      ? text(options.creator, "Creator", 100)
      : "Your community",
    sessionTitle: "Our next shared adventure",
    brief: {
      title: "",
      context: "",
      stakes: "",
      action: "",
      choices: [
        { id: "A", label: "" },
        { id: "B", label: "" },
      ],
      expiresAt: new Date(at.ms + 30 * 60_000).toISOString(),
      status: "draft",
      version: 0,
      publishedAt: null,
    },
    proposals: [],
    contributions: [],
    raids: [],
    activity: [],
    processedIds: [],
    cooldowns: {},
    opens: 0,
    createdAt: at.iso,
    updatedAt: at.iso,
    revision: 0,
  };
}

export function createDemoState(now?: string): RallyState {
  const at = time(now);
  let state = createState(
    {
      id: "demo",
      publicId: "demo",
      channel: "rallypoint_demo",
      creator: "Shivam Gupta",
    },
    at.iso,
  );
  state.sessionTitle = "One tiny rescue. An entire community.";
  state = transition(
    state,
    {
      type: "publish",
      brief: {
        title: "Operation: save the axolotl",
        context:
          "Bubbles is stranded across the ravine. We lost our last bucket, so chat is planning the rescue route.",
        stakes: "One life left. Get Bubbles home before nightfall.",
        action: "Choose our rescue route. Type !join A or !join B in chat.",
        choices: [
          { id: "A", label: "Build a bridge" },
          { id: "B", label: "Dig a tunnel" },
        ],
        expiresAt: new Date(at.ms + 20 * 60_000).toISOString(),
      },
    },
    new Date(at.ms - 6 * 60_000).toISOString(),
  ).state;
  const demoNames = [
    "mossyboots",
    "pixelpilot",
    "cozycraft",
    "redstone_rue",
    "fernfriend",
    "luna_blocks",
  ];
  for (let index = 0; index < demoNames.length; index++) {
    state = transition(
      state,
      {
        type: "chat",
        messageId: `demo-vote-${index}`,
        userId: `demo-user-${index}`,
        name: demoNames[index],
        text: `!join ${index === 2 || index === 5 ? "B" : "A"}`,
      },
      new Date(at.ms - (5 - index) * 35_000).toISOString(),
    ).state;
  }
  state = transition(
    state,
    {
      type: "chat",
      messageId: "demo-pitch-1",
      userId: "demo-pitcher-1",
      name: "mossyboots",
      text: "!pitch There is iron beside the old mineshaft. We can craft a new bucket.",
    },
    new Date(at.ms - 90_000).toISOString(),
  ).state;
  state = transition(
    state,
    {
      type: "chat",
      messageId: "demo-pitch-2",
      userId: "demo-pitcher-2",
      name: "pixelpilot",
      text: "!pitch A covered bridge would keep Bubbles safe from skeletons.",
    },
    new Date(at.ms - 50_000).toISOString(),
  ).state;
  state.opens = 12;
  state.updatedAt = at.iso;
  return state;
}

/** Pure state machine. Authorization belongs to the server; never expose this as an unauthenticated write API. */
export function transition(
  input: RallyState,
  action: Action,
  now?: string,
): Transition {
  const at = time(now);
  if (!action || typeof action !== "object" || typeof action.type !== "string")
    throw new Error("A valid action is required.");
  if (action.type === "reset") {
    const state = createState(
      {
        id: input.id,
        publicId: input.publicId,
        channel: input.channel || undefined,
        creator: input.creator,
      },
      at.iso,
    );
    state.revision = input.revision + 1;
    return { state, changed: true };
  }
  const state = structuredClone(input);
  let reply: string | undefined;
  switch (action.type) {
    case "publish": {
      if (
        action.expectedVersion !== undefined &&
        (!Number.isInteger(action.expectedVersion) ||
          action.expectedVersion !== state.brief.version)
      )
        throw new Error(
          "This brief changed in another tab. Refresh before publishing.",
        );
      const brief = validateBrief(action.brief, at.ms);
      state.brief = {
        ...brief,
        status: "live",
        version: state.brief.version + 1,
        publishedAt: at.iso,
      };
      addActivity(
        state,
        "publish",
        "Participation brief published",
        `Chapter ${state.brief.version}: ${state.brief.title}`,
        at.iso,
      );
      break;
    }
    case "close":
      if (state.brief.status === "closed")
        return { state: input, changed: false };
      state.brief.status = "closed";
      addActivity(
        state,
        "close",
        "Chapter closed",
        "The previous chat action is no longer available.",
        at.iso,
      );
      break;
    case "settings":
      state.channel = channel(action.channel);
      state.sessionTitle = text(action.sessionTitle, "Session title", 140);
      addActivity(
        state,
        "settings",
        "Stream details updated",
        state.sessionTitle,
        at.iso,
      );
      break;
    case "review": {
      if (action.decision !== "accepted" && action.decision !== "rejected")
        throw new Error("Choose accept or reject.");
      const proposalId = id(action.proposalId, "Proposal ID");
      const proposal = state.proposals.find(
        (proposal) => proposal.id === proposalId,
      );
      if (!proposal) throw new Error("This community update no longer exists.");
      if (proposal.status !== "pending")
        return { state: input, changed: false };
      proposal.status = action.decision;
      addActivity(
        state,
        "review",
        action.decision === "accepted"
          ? "Community update accepted"
          : "Community update dismissed",
        action.decision === "accepted"
          ? `${proposal.author}'s update is ready for the next brief. Publication still needs streamer approval.`
          : "The update stayed off the public brief.",
        at.iso,
      );
      break;
    }
    case "raid": {
      const eventId = `raid:${id(action.eventId, "Event ID")}`;
      const from = text(action.from, "Raiding channel", 40);
      if (
        !Number.isInteger(action.viewers) ||
        action.viewers < 1 ||
        action.viewers > 10_000_000
      )
        throw new Error("Raid size must be a positive whole number.");
      if (action.at !== undefined && typeof action.at !== "string")
        throw new Error("A valid event timestamp is required.");
      const eventAt = action.at !== undefined ? time(action.at) : at;
      if (eventAt.ms > at.ms + 60_000)
        throw new Error("The raid timestamp is in the future.");
      if (!remember(state, eventId)) return { state: input, changed: false };
      state.raids = [
        {
          id: eventId,
          from,
          viewers: action.viewers,
          at: eventAt.iso,
          welcomeUntil: new Date(eventAt.ms + 90_000).toISOString(),
        },
        ...state.raids,
      ]
        .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
        .slice(0, LIMITS.raids);
      addActivity(
        state,
        "raid",
        `${from} brought a raid`,
        `${action.viewers} viewers invited into the current chapter.`,
        at.iso,
      );
      break;
    }
    case "chat": {
      const messageId = `chat:${id(action.messageId, "Message ID")}`;
      const userId = id(action.userId, "Viewer ID");
      const name = text(action.name, "Viewer name", 60);
      const message = text(action.text, "Chat message", 500);
      const voteMatch = /^!(?:join|vote)\s+([a-z0-9]{1,8})\s*$/i.exec(message);
      const pitchMatch = /^!pitch(?:\s+([\s\S]+))?$/i.exec(message);
      const isCatchup = /^!catchup\s*$/i.test(message);
      if (!voteMatch && !pitchMatch && !isCatchup)
        return { state: input, changed: false };
      if (action.at !== undefined && typeof action.at !== "string")
        throw new Error("A valid event timestamp is required.");
      const eventAt = action.at !== undefined ? time(action.at) : at;
      if (eventAt.ms > at.ms + 60_000)
        throw new Error("The chat timestamp is in the future.");
      if (!remember(state, messageId)) return { state: input, changed: false };
      // A delayed event belongs to the chapter that was live when it happened.
      // Never let a previous chapter's command vote on or reveal a newer brief.
      if (
        state.brief.publishedAt &&
        eventAt.ms < Date.parse(state.brief.publishedAt)
      )
        break;
      const chatActive =
        active(state, at.ms) && eventAt.ms < Date.parse(state.brief.expiresAt);
      if (voteMatch) {
        if (!chatActive) {
          reply = NO_ACTION;
          break;
        }
        const choiceId = voteMatch[1].toUpperCase();
        const choice = state.brief.choices.find(
          (choice) => choice.id === choiceId,
        );
        if (!choice) {
          reply = `Choose ${state.brief.choices.map((choice) => `!join ${choice.id}`).join(" or ")}.`;
          break;
        }
        const existing = state.contributions.find(
          (row) => row.userId === userId && row.version === state.brief.version,
        );
        if (existing && Date.parse(existing.at) > eventAt.ms) break;
        if (!cooldown(state, `vote:${userId}`, at.ms, 2000)) break;
        if (existing) {
          existing.choiceId = choiceId;
          existing.name = name;
          existing.at = eventAt.iso;
        } else {
          const raid = state.raids.find(
            (raid) =>
              Date.parse(raid.at) <= eventAt.ms &&
              Date.parse(raid.welcomeUntil) > eventAt.ms,
          );
          if (state.contributions.length >= LIMITS.contributions) {
            reply =
              "This workspace has reached its contribution limit. The streamer can export and start a fresh session.";
            break;
          }
          state.contributions.push({
            id: uuid(),
            userId,
            name,
            choiceId,
            version: state.brief.version,
            at: eventAt.iso,
            raidId: raid?.id ?? null,
          });
          addActivity(
            state,
            "join",
            `${name} joined the decision`,
            choice.label,
            at.iso,
          );
        }
      } else if (pitchMatch) {
        if (!chatActive) {
          reply = NO_ACTION;
          break;
        }
        const proposalText = (pitchMatch[1] ?? "").trim();
        if (proposalText.length < 8 || proposalText.length > 280) {
          reply =
            "Use !pitch followed by an update of 8–280 characters. It will wait for streamer review.";
          break;
        }
        if (!cooldown(state, `pitch:${userId}`, at.ms, 30_000)) break;
        if (
          state.proposals.filter((proposal) => proposal.status === "pending")
            .length >= 100
        ) {
          reply =
            "The community review queue is full. Please wait for the streamer to review it.";
          break;
        }
        state.proposals = [
          {
            id: uuid(),
            author: name,
            text: proposalText,
            sourceId: action.messageId,
            createdAt: eventAt.iso,
            status: "pending" as const,
          },
          ...state.proposals,
        ].slice(0, LIMITS.proposals);
        addActivity(
          state,
          "pitch",
          "A community update is waiting",
          `${name} submitted an update for review.`,
          at.iso,
        );
      } else if (
        isCatchup &&
        cooldown(state, `catchup:${userId}`, at.ms, 15_000)
      ) {
        reply = chatActive ? catchup(state) : NO_ACTION;
      }
      break;
    }
    case "open":
      state.opens = Math.min(Number.MAX_SAFE_INTEGER, state.opens + 1);
      break;
    default:
      throw new Error("Unknown action.");
  }
  // Limit replies across all viewers as well as per viewer. A raid must not turn
  // helpful commands or invalid-input guidance into a flood of broadcaster chat.
  if (reply && !cooldown(state, "global:reply", at.ms, 5000)) reply = undefined;
  // Cooldowns expire after a day. Bound unique actors even during unusually large raids.
  state.cooldowns = Object.fromEntries(
    Object.entries(state.cooldowns)
      .filter(([, ms]) => ms >= at.ms - DAY)
      .sort((a, b) => b[1] - a[1])
      .slice(0, LIMITS.cooldowns),
  );
  state.updatedAt = at.iso;
  state.revision = input.revision + 1;
  return { state, reply, changed: true };
}

function clip(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}
function catchup(state: RallyState): string {
  const brief = state.brief;
  const options = brief.choices
    .map((choice) => `!join ${choice.id}: ${clip(choice.label, 35)}`)
    .join(" | ");
  return clip(
    `NOW: ${clip(brief.title, 80)}. WHY: ${clip(brief.context, 140)} ${clip(brief.stakes, 70)} JOIN: ${options}`,
    480,
  );
}

/** Public projections never include moderation text, Twitch message IDs or stable viewer identities. */
export function publicState(input: RallyState): RallyState {
  const metrics = stats(input);
  // Send aggregate counts, never one row per person. This also keeps viewer and
  // OBS polling responses small regardless of the number of participants.
  const state = structuredClone({
    ...input,
    contributions: [],
    proposals: [],
    processedIds: [],
    cooldowns: {},
  });
  state.publicMetrics = {
    currentContributors: metrics.currentContributors,
    counts: metrics.votes,
    raidWindowContributors: metrics.raidWindowContributors,
    totalContributors: metrics.totalContributors,
  };
  state.id = state.publicId;
  state.creator = "";
  state.proposals = [];
  state.processedIds = [];
  state.cooldowns = {};
  state.contributions = [];
  state.activity = state.activity
    .filter(
      (row) =>
        row.kind === "publish" || row.kind === "close" || row.kind === "raid",
    )
    .map((row) => ({ ...row, id: "" }));
  return state;
}

export function stats(state: RallyState, now?: string) {
  const at = time(now);
  const votes = state.contributions.filter(
    (row) => row.version === state.brief.version,
  );
  const counts = Object.fromEntries(
    state.brief.choices.map((choice) => [
      choice.id,
      state.publicMetrics
        ? (state.publicMetrics.counts[choice.id] ?? 0)
        : votes.filter((row) => row.choiceId === choice.id).length,
    ]),
  );
  const currentContributors =
    state.publicMetrics?.currentContributors ?? votes.length;
  const latestRaid = state.raids[0];
  return {
    active: active(state, at.ms),
    expired:
      state.brief.status === "live" &&
      Date.parse(state.brief.expiresAt) <= at.ms,
    votes: counts,
    choices: state.brief.choices.map((choice) => ({
      ...choice,
      count: counts[choice.id],
      percentage: currentContributors
        ? Math.round((counts[choice.id] * 100) / currentContributors)
        : 0,
    })),
    totalContributors:
      state.publicMetrics?.totalContributors ??
      new Set(state.contributions.map((row) => row.userId || row.id)).size,
    currentContributors,
    totalVotes: currentContributors,
    raidWindowContributors:
      state.publicMetrics?.raidWindowContributors ??
      (latestRaid
        ? votes.filter((row) => row.raidId === latestRaid.id).length
        : 0),
    approvedUpdates: state.proposals.filter(
      (proposal) => proposal.status === "accepted",
    ).length,
    pendingUpdates: state.proposals.filter(
      (proposal) => proposal.status === "pending",
    ).length,
    opens: state.opens,
  };
}
