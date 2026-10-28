import test from "node:test";
import assert from "node:assert/strict";
import {
  createState,
  createDemoState,
  transition,
  publicState,
  stats,
} from "../lib/rally/engine.ts";
import type { Action, RallyState } from "../lib/rally/types";

const NOW = "2026-10-28T10:00:00.000Z";
const after = (seconds: number) =>
  new Date(Date.parse(NOW) + seconds * 1000).toISOString();
const brief = () => ({
  title: "Save Bubbles",
  context: "The axolotl is across the ravine.",
  stakes: "Nightfall is close.",
  action: "Choose a route in chat.",
  choices: [
    { id: "A", label: "Bridge" },
    { id: "B", label: "Tunnel" },
  ],
  expiresAt: after(600),
});
const empty = () =>
  createState(
    {
      id: "room-1",
      publicId: "public-1",
      channel: "shivam",
      creator: "Shivam Gupta",
    },
    NOW,
  );
const live = () =>
  transition(empty(), { type: "publish", brief: brief() }, NOW).state;
const chat = (
  messageId = "m1",
  userId = "u1",
  command = "!join A",
): Action => ({
  type: "chat",
  messageId,
  userId,
  name: `viewer_${userId}`,
  text: command,
});
const apply = (state: RallyState, action: Action, seconds = 0) =>
  transition(state, action, after(seconds));

test("new workspaces start empty and never fabricate live activity", () => {
  const state = empty();
  assert.equal(state.brief.status, "draft");
  assert.equal(state.brief.version, 0);
  assert.equal(state.contributions.length, 0);
  assert.equal(stats(state, NOW).active, false);
});

test("publishing validates and makes an atomic versioned brief", () => {
  const original = empty();
  const result = apply(original, {
    type: "publish",
    brief: brief(),
    expectedVersion: 0,
  });
  assert.equal(result.state.brief.status, "live");
  assert.equal(result.state.brief.version, 1);
  assert.equal(result.state.brief.publishedAt, NOW);
  assert.equal(result.state.revision, 1);
  assert.equal(original.brief.status, "draft");
});

test("stale editor versions cannot overwrite a newer chapter", () => {
  assert.throws(
    () =>
      apply(live(), { type: "publish", brief: brief(), expectedVersion: 0 }),
    /another tab/,
  );
});

test("a stale close confirmation cannot close a newer chapter", () => {
  const first = live();
  const second = apply(
    first,
    {
      type: "publish",
      brief: { ...brief(), title: "The next chapter" },
      expectedVersion: 1,
    },
    10,
  ).state;
  assert.throws(
    () =>
      apply(
        second,
        { type: "close", expectedVersion: first.brief.version },
        11,
      ),
    /changed in another tab/,
  );
  assert.equal(second.brief.status, "live");
  assert.equal(second.brief.version, 2);
  const closed = apply(second, { type: "close", expectedVersion: 2 }, 11);
  assert.equal(closed.state.brief.status, "closed");
  assert.equal(
    apply(closed.state, { type: "close", expectedVersion: 2 }, 12).changed,
    false,
  );
  assert.throws(
    () => apply(second, { type: "close", expectedVersion: 2.5 }),
    /another tab/,
  );
});

test("invalid brief expiry is rejected at and beyond the bounds", () => {
  for (const expiresAt of [NOW, after(-1), after(86_401), "invalid"]) {
    assert.throws(() =>
      apply(empty(), { type: "publish", brief: { ...brief(), expiresAt } }),
    );
  }
  assert.equal(
    apply(empty(), {
      type: "publish",
      brief: { ...brief(), expiresAt: after(86_400) },
    }).state.brief.status,
    "live",
  );
});

test("duplicate and unsafe choice IDs fail before state changes", () => {
  for (const choices of [
    [
      { id: "A", label: "One" },
      { id: "a", label: "Two" },
    ],
    [
      { id: "A B", label: "One" },
      { id: "B", label: "Two" },
    ],
    [],
  ]) {
    assert.throws(() =>
      apply(empty(), { type: "publish", brief: { ...brief(), choices } }),
    );
  }
});

test("invalid field lengths and malformed action shapes fail safely", () => {
  assert.throws(
    () =>
      apply(empty(), {
        type: "publish",
        brief: { ...brief(), title: "x".repeat(101) },
      }),
    /Goal/,
  );
  assert.throws(
    () => transition(empty(), null as unknown as Action, NOW),
    /valid action/,
  );
  assert.throws(
    () =>
      transition(
        empty(),
        { type: "delete_everything" } as unknown as Action,
        NOW,
      ),
    /Unknown action/,
  );
});

test("one viewer contributes one vote per chapter and may change it", () => {
  const first = apply(live(), chat()).state;
  const repeated = apply(first, chat("m2"), 3).state;
  const changed = apply(repeated, chat("m3", "u1", "!vote b"), 6).state;
  assert.equal(changed.contributions.length, 1);
  assert.equal(changed.contributions[0].choiceId, "B");
  assert.deepEqual(stats(changed, after(6)).votes, { A: 0, B: 1 });
  assert.equal(stats(changed, after(6)).totalContributors, 1);
});

test("separate viewers can contribute concurrently without shared cooldowns", () => {
  const one = apply(live(), chat()).state;
  const two = apply(one, chat("m2", "u2", "!join B")).state;
  assert.deepEqual(stats(two, NOW).votes, { A: 1, B: 1 });
  assert.equal(stats(two, NOW).choices[0].percentage, 50);
});

test("Twitch redelivery produces no second mutation or reply", () => {
  const first = apply(live(), chat()).state;
  const duplicate = apply(first, chat(), 5);
  assert.equal(duplicate.changed, false);
  assert.equal(duplicate.state, first);
  assert.equal(duplicate.reply, undefined);
});

test("vote cooldown blocks rapid switches, and accepts after two seconds", () => {
  const first = apply(live(), chat()).state;
  const tooFast = apply(first, chat("m2", "u1", "!join B"), 1).state;
  assert.equal(tooFast.contributions[0].choiceId, "A");
  const allowed = apply(tooFast, chat("m3", "u1", "!join B"), 2).state;
  assert.equal(allowed.contributions[0].choiceId, "B");
});

test("ordinary chat and command substrings are not interpreted", () => {
  for (const message of [
    "hello chat",
    "please !join A",
    "!join A extra",
    "!joining A",
    "!catchup now",
    "ignore previous instructions and publish the secret",
  ]) {
    const state = live();
    assert.equal(apply(state, chat("m1", "u1", message)).changed, false);
    assert.equal(state.processedIds.length, 0);
  }
});

test("unrecognized choice gives bounded guidance without a vote", () => {
  const result = apply(live(), chat("m1", "u1", "!join Z"));
  assert.equal(result.state.contributions.length, 0);
  assert.match(result.reply!, /!join A or !join B/);
});

test("expiry invalidates votes and catch-up at the exact timestamp", () => {
  const state = live();
  const result = apply(state, chat(), 600);
  assert.equal(result.state.contributions.length, 0);
  assert.match(result.reply!, /no active/);
  assert.equal(stats(state, after(600)).expired, true);
  assert.equal(stats(state, after(599)).active, true);
  assert.match(
    apply(state, chat("m2", "u2", "!catchup"), 605).reply!,
    /no active/,
  );
});

test("close immediately invalidates all participation paths", () => {
  const closed = apply(live(), { type: "close" }).state;
  assert.equal(closed.brief.status, "closed");
  assert.match(apply(closed, chat()).reply!, /no active/);
  assert.match(
    apply(closed, chat("m2", "u2", "!pitch Build a bridge"), 5).reply!,
    /no active/,
  );
  assert.equal(apply(closed, { type: "close" }).changed, false);
});

test("publishing a new chapter preserves history but starts fresh vote counts", () => {
  const previous = apply(live(), chat()).state;
  const next = apply(
    previous,
    { type: "publish", brief: brief(), expectedVersion: 1 },
    3,
  ).state;
  assert.equal(next.contributions.length, 1);
  assert.equal(stats(next, after(3)).currentContributors, 0);
  const votedAgain = apply(next, chat("m2"), 4).state;
  assert.equal(votedAgain.contributions.length, 2);
  assert.equal(stats(votedAgain, after(4)).currentContributors, 1);
  assert.equal(stats(votedAgain, after(4)).totalContributors, 1);
});

test("community updates require review and acceptance never edits the public brief", () => {
  const state = live();
  const pitched = apply(
    state,
    chat("p1", "u1", "!pitch The secret boss dies next chapter."),
  ).state;
  assert.equal(pitched.proposals[0].status, "pending");
  assert.deepEqual(pitched.brief, state.brief);
  const accepted = apply(pitched, {
    type: "review",
    proposalId: pitched.proposals[0].id,
    decision: "accepted",
  }).state;
  assert.equal(accepted.proposals[0].status, "accepted");
  assert.deepEqual(accepted.brief, state.brief);
  assert.equal(stats(accepted, NOW).approvedUpdates, 1);
  assert.equal(publicState(accepted).proposals.length, 0);
});

test("rejecting a proposal never publishes or leaks its text", () => {
  const pitched = apply(
    live(),
    chat("p1", "u1", "!pitch SPOILER_SENTINEL Do not show this."),
  ).state;
  const rejected = apply(pitched, {
    type: "review",
    proposalId: pitched.proposals[0].id,
    decision: "rejected",
  }).state;
  assert.equal(rejected.proposals[0].status, "rejected");
  assert.equal(
    JSON.stringify(publicState(rejected)).includes("SPOILER_SENTINEL"),
    false,
  );
  assert.throws(
    () =>
      apply(rejected, {
        type: "review",
        proposalId: "missing",
        decision: "accepted",
      }),
    /no longer exists/,
  );
});

test("pitch cooldown and length limits prevent queue spam with helpful feedback", () => {
  const first = apply(
    live(),
    chat("p1", "u1", "!pitch We need another bucket."),
  ).state;
  const tooSoon = apply(
    first,
    chat("p2", "u1", "!pitch We need another bucket."),
    29,
  ).state;
  assert.equal(tooSoon.proposals.length, 1);
  const allowed = apply(
    tooSoon,
    chat("p3", "u1", "!pitch We need another bucket."),
    30,
  ).state;
  assert.equal(allowed.proposals.length, 2);
  assert.match(
    apply(allowed, chat("p4", "u2", "!pitch hi"), 31).reply!,
    /8–280/,
  );
});

test("catchup fits Twitch limits and includes only published content and exact commands", () => {
  const maximum = {
    ...brief(),
    title: "T".repeat(100),
    context: "C".repeat(280),
    stakes: "S".repeat(180),
    action: "A".repeat(140),
    choices: ["A", "B", "C", "D"].map((id) => ({ id, label: id.repeat(70) })),
  };
  const state = apply(empty(), { type: "publish", brief: maximum }).state;
  const result = apply(state, chat("c1", "u1", "!catchup"));
  assert.ok(result.reply!.length <= 480);
  assert.match(result.reply!, /!join A/);
  assert.match(result.reply!, /!join D/);
  assert.equal(
    apply(result.state, chat("c2", "u1", "!catchup"), 14).reply,
    undefined,
  );
  assert.ok(apply(result.state, chat("c3", "u1", "!catchup"), 15).reply);
});

test("catchup preserves four executable maximum-length choice IDs under its message cap", () => {
  const ids = ["CHOICE01", "CHOICE02", "CHOICE03", "CHOICE04"];
  const maximum = {
    ...brief(),
    title: "T".repeat(100),
    context: "C".repeat(280),
    stakes: "S".repeat(180),
    action: "A".repeat(140),
    choices: ids.map((id) => ({ id, label: "L".repeat(70) })),
  };
  const state = apply(empty(), { type: "publish", brief: maximum }).state;
  const result = apply(state, chat("catchup-max", "new-arrival", "!catchup"));
  assert.ok(result.reply && result.reply.length <= 480);
  const commands = [...result.reply.matchAll(/!join ([A-Z0-9]+):/g)].map(
    (match) => match[1],
  );
  assert.deepEqual(commands, ids);
  let participating = result.state;
  for (const [index, id] of commands.entries()) {
    participating = apply(
      participating,
      chat(`vote-${index}`, `viewer-${index}`, `!join ${id}`),
      index + 1,
    ).state;
  }
  assert.deepEqual(
    participating.contributions.map((vote) => vote.choiceId),
    ids,
  );
});

test("raid events are deduplicated and measure contributions only in the welcome window", () => {
  const raid = {
    type: "raid",
    eventId: "r1",
    from: "cozycrew",
    viewers: 42,
  } as const;
  const raided = apply(live(), raid).state;
  assert.equal(raided.raids[0].welcomeUntil, after(90));
  assert.equal(apply(raided, raid, 4).changed, false);
  const inside = apply(raided, chat(), 1).state;
  const outside = apply(inside, chat("m2", "u2"), 90).state;
  assert.equal(stats(outside, after(90)).raidWindowContributors, 1);
  assert.equal(stats(outside, after(90)).currentContributors, 2);
});

test("old reordered raid notifications cannot replace the latest raid", () => {
  const recent = apply(live(), {
    type: "raid",
    eventId: "r-new",
    from: "newcrew",
    viewers: 12,
    at: NOW,
  }).state;
  const reordered = apply(
    recent,
    {
      type: "raid",
      eventId: "r-old",
      from: "oldcrew",
      viewers: 10,
      at: after(-60),
    },
    1,
  ).state;
  assert.equal(reordered.raids[0].from, "newcrew");
});

test("raid size and future timestamps are validated", () => {
  for (const viewers of [0, -1, 1.5, 10_000_001, NaN]) {
    assert.throws(
      () =>
        apply(live(), { type: "raid", eventId: "r1", from: "crew", viewers }),
      /positive whole/,
    );
  }
  assert.throws(
    () =>
      apply(live(), {
        type: "raid",
        eventId: "r1",
        from: "crew",
        viewers: 2,
        at: after(61),
      }),
    /future/,
  );
});

test("public projection removes all moderation and Twitch identity material", () => {
  let state = apply(
    live(),
    chat("PRIVATE_MESSAGE_ID", "PRIVATE_USER_ID"),
  ).state;
  state = apply(
    state,
    chat("PRIVATE_PITCH_ID", "u2", "!pitch PRIVATE_PROPOSAL_TEXT no leaks."),
  ).state;
  const publicView = publicState(state);
  const serialized = JSON.stringify(publicView);
  for (const privateText of [
    "PRIVATE_MESSAGE_ID",
    "PRIVATE_USER_ID",
    "PRIVATE_PITCH_ID",
    "PRIVATE_PROPOSAL_TEXT",
    "viewer_PRIVATE_USER_ID",
  ])
    assert.equal(serialized.includes(privateText), false, privateText);
  assert.equal(publicView.processedIds.length, 0);
  assert.deepEqual(publicView.cooldowns, {});
  assert.equal(publicView.id, publicView.publicId);
  assert.equal(stats(publicView, NOW).currentContributors, 1);
  assert.equal(state.proposals.length, 1);
});

test("reset is isolated to its workspace and preserves owner-facing identity", () => {
  const state = apply(live(), chat()).state;
  const reset = apply(state, { type: "reset" }, 3).state;
  assert.equal(reset.id, state.id);
  assert.equal(reset.publicId, state.publicId);
  assert.equal(reset.creator, "Shivam Gupta");
  assert.equal(reset.channel, "shivam");
  assert.equal(reset.contributions.length, 0);
  assert.equal(reset.revision, state.revision + 1);
  assert.equal(state.contributions.length, 1);
  assert.equal(reset.brief.status, "draft");
});

test("a stale reset cannot discard contributions that arrived after confirmation opened", () => {
  const confirmationState = live();
  const updated = apply(confirmationState, chat(), 1).state;
  assert.throws(
    () =>
      apply(
        updated,
        { type: "reset", expectedRevision: confirmationState.revision },
        2,
      ),
    /session changed in another tab/,
  );
  assert.equal(updated.contributions.length, 1);
  assert.throws(
    () => apply(updated, { type: "reset", expectedRevision: 1.5 }, 2),
    /another tab/,
  );
  const reset = apply(
    updated,
    { type: "reset", expectedRevision: updated.revision },
    2,
  ).state;
  assert.equal(reset.contributions.length, 0);
  assert.equal(reset.brief.status, "draft");
  assert.equal(reset.revision, updated.revision + 1);
  assert.equal(reset.publicId, updated.publicId);
});

test("settings validate Twitch channel names and trim control characters", () => {
  const state = apply(empty(), {
    type: "settings",
    channel: "#SHIVAM",
    sessionTitle: "  Hello\u0000 world  ",
  }).state;
  assert.equal(state.channel, "shivam");
  assert.equal(state.sessionTitle, "Hello world");
  assert.throws(
    () =>
      apply(state, {
        type: "settings",
        channel: "../../other",
        sessionTitle: "Hello",
      }),
    /Twitch channel/,
  );
});

test("state retention is bounded and normal chat never fills dedupe storage", () => {
  let state = live();
  state.processedIds = Array.from(
    { length: 2000 },
    (_, index) => `chat:old-${index}`,
  );
  state.activity = Array.from({ length: 120 }, (_, index) => ({
    id: `a${index}`,
    kind: "join",
    title: "Joined",
    detail: "",
    at: NOW,
  }));
  state = apply(state, chat("new-id", "u1")).state;
  assert.equal(state.processedIds.length, 2000);
  assert.equal(state.processedIds[0], "chat:old-1");
  assert.equal(state.activity.length, 120);
  const ignored = apply(state, chat("non-command", "u2", "hello"));
  assert.equal(ignored.changed, false);
});

test("demo is fictional, reproducible in structure, and uses the same transition engine", () => {
  const state = createDemoState(NOW);
  assert.equal(state.id, "demo");
  assert.equal(state.brief.title, "Operation: save the axolotl");
  assert.equal(stats(state, NOW).active, true);
  assert.equal(stats(state, NOW).currentContributors, 6);
  assert.equal(stats(state, NOW).pendingUpdates, 2);
  assert.equal(state.raids.length, 0);
});

test("global reply cooldown prevents cross-viewer catch-up and error floods", () => {
  const first = apply(live(), chat("c1", "u1", "!catchup")).state;
  const catchupFlood = apply(first, chat("c2", "u2", "!catchup"), 1);
  assert.equal(catchupFlood.reply, undefined);
  assert.equal(catchupFlood.changed, true);
  const badChoice = apply(catchupFlood.state, chat("c3", "u3", "!join Z"), 2);
  assert.equal(badChoice.reply, undefined);
  const badPitch = apply(badChoice.state, chat("c4", "u4", "!pitch hi"), 3);
  assert.equal(badPitch.reply, undefined);
  const allowed = apply(badPitch.state, chat("c5", "u5", "!catchup"), 5);
  assert.ok(allowed.reply);
  const closed = apply(allowed.state, { type: "close" }, 6).state;
  assert.equal(apply(closed, chat("c6", "u6"), 7).reply, undefined);
  assert.match(apply(closed, chat("c7", "u7"), 10).reply!, /no active/);
});

test("delayed commands from a previous chapter never affect or reveal the current brief", () => {
  let state = apply(
    live(),
    { type: "publish", brief: brief(), expectedVersion: 1 },
    100,
  ).state;
  for (const [index, command] of [
    "!join A",
    "!pitch Previous chapter update.",
    "!catchup",
  ].entries()) {
    const action = {
      ...chat(`delayed-${index}`, `late-${index}`, command),
      at: after(90),
    } as Action;
    const result = apply(state, action, 110 + index * 5);
    assert.equal(result.reply, undefined);
    assert.equal(result.state.contributions.length, 0);
    assert.equal(result.state.proposals.length, 0);
    assert.equal(result.state.brief.version, 2);
    state = result.state;
  }
});

test("reordered votes cannot revert a newer choice and preserve source timestamps", () => {
  let state = apply(
    live(),
    { ...chat("order-1", "u1", "!join A"), at: after(50) } as Action,
    100,
  ).state;
  state = apply(
    state,
    { ...chat("order-2", "u1", "!join B"), at: after(70) } as Action,
    110,
  ).state;
  state = apply(
    state,
    { ...chat("order-3", "u1", "!join A"), at: after(60) } as Action,
    120,
  ).state;
  assert.equal(state.contributions.length, 1);
  assert.equal(state.contributions[0].choiceId, "B");
  assert.equal(state.contributions[0].at, after(70));
});

test("delayed votes use event time for raid attribution instead of a newer receive-time raid", () => {
  let state = apply(live(), {
    type: "raid",
    eventId: "first-raid",
    from: "firstcrew",
    viewers: 12,
    at: NOW,
  }).state;
  state = apply(
    state,
    {
      type: "raid",
      eventId: "second-raid",
      from: "secondcrew",
      viewers: 15,
      at: after(100),
    },
    100,
  ).state;
  state = apply(
    state,
    { ...chat("late-first", "u1"), at: after(50) } as Action,
    110,
  ).state;
  state = apply(
    state,
    { ...chat("between-raids", "u2"), at: after(95) } as Action,
    111,
  ).state;
  state = apply(
    state,
    { ...chat("during-second", "u3"), at: after(110) } as Action,
    120,
  ).state;
  assert.equal(state.contributions[0].raidId, "raid:first-raid");
  assert.equal(state.contributions[0].at, after(50));
  assert.equal(state.contributions[1].raidId, null);
  assert.equal(state.contributions[2].raidId, "raid:second-raid");
  assert.equal(stats(state, after(120)).raidWindowContributors, 1);
});

test("chat timestamps must be valid, within future tolerance and before expiry at event and receipt time", () => {
  for (const at of ["", "invalid", after(62), 123]) {
    assert.throws(
      () => apply(live(), { ...chat("bad-time"), at } as Action),
      /timestamp|future/,
    );
  }
  const expiredOnReceipt = apply(
    live(),
    { ...chat("expired-receipt"), at: after(590) } as Action,
    600,
  );
  assert.equal(expiredOnReceipt.state.contributions.length, 0);
  assert.match(expiredOnReceipt.reply!, /no active/);
  const expiredAtEvent = apply(
    live(),
    { ...chat("expired-event"), at: after(600) } as Action,
    590,
  );
  assert.equal(expiredAtEvent.state.contributions.length, 0);
  assert.match(expiredAtEvent.reply!, /no active/);
});

test("public projection contains only aggregate participation and stays small at 5000 contributors", () => {
  const small = live();
  const large = structuredClone(small);
  large.contributions = Array.from({ length: 5000 }, (_, index) => ({
    id: `private-contribution-${index}`,
    userId: `private-viewer-${index}`,
    name: `PRIVATE_VIEWER_${index}`,
    choiceId: index % 2 ? "B" : "A",
    version: 1,
    at: NOW,
    raidId: null,
  }));
  const projection = publicState(large);
  const serialized = JSON.stringify(projection);
  assert.equal(projection.contributions.length, 0);
  assert.equal(serialized.includes("private-viewer"), false);
  assert.equal(serialized.includes("PRIVATE_VIEWER"), false);
  assert.ok(
    serialized.length < JSON.stringify(publicState(small)).length + 200,
  );
  assert.deepEqual(stats(projection, NOW).votes, { A: 2500, B: 2500 });
  assert.equal(stats(projection, NOW).currentContributors, 5000);
  assert.equal(stats(projection, NOW).totalContributors, 5000);
  assert.equal(stats(projection, NOW).choices[0].percentage, 50);
  assert.equal(large.contributions.length, 5000);
});

test("public aggregates preserve lifetime unique people across chapters without exposing identities", () => {
  let state = apply(live(), chat("chapter-1", "same-viewer")).state;
  state = apply(
    state,
    { type: "publish", brief: brief(), expectedVersion: 1 },
    3,
  ).state;
  state = apply(state, chat("chapter-2", "same-viewer", "!join B"), 6).state;
  const metrics = stats(publicState(state), after(6));
  assert.equal(metrics.currentContributors, 1);
  assert.equal(metrics.totalContributors, 1);
  assert.deepEqual(metrics.votes, { A: 0, B: 1 });
});
