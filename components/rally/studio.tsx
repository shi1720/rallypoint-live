"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  ClipboardList,
  Clock3,
  Copy,
  ExternalLink,
  Flag,
  Inbox,
  LayoutDashboard,
  Link2,
  LoaderCircle,
  MessageSquare,
  Monitor,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Square,
  Terminal,
  TrendingUp,
  Users,
  X,
  Zap,
} from "lucide-react";
import type {
  Action,
  Brief,
  Connection,
  Proposal,
  RallyState,
} from "@/lib/rally/types";
import {
  Brand,
  Badge,
  BriefCard,
  CopyButton,
  EmptyState,
  MissionMap,
  TwitchGlyph,
  activeBrief,
  currentMetrics,
  expiryText,
  relativeTime,
  useNow,
} from "./shared";
import { useRally } from "./use-rally";

type Tab = "desk" | "inbox" | "insights" | "setup";
type Draft = Pick<
  Brief,
  "title" | "context" | "stakes" | "action" | "choices" | "expiresAt"
>;
const BRIEF_TEMPLATES: {
  name: string;
  detail: string;
  brief: Omit<Draft, "expiresAt">;
}[] = [
  {
    name: "Community rescue",
    detail: "A shared adventure",
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
    },
  },
  {
    name: "Maker build",
    detail: "Create something together",
    brief: {
      title: "The community reading nook",
      context:
        "We are building a tiny reading nook together. The frame is finished; now chat gets to shape the atmosphere.",
      stakes:
        "This is the corner we will return to on every future stream. Make it feel like us.",
      action:
        "Pick our next design direction. Type !join A or !join B in chat.",
      choices: [
        { id: "A", label: "Warm wood and soft lighting" },
        { id: "B", label: "Plants and a window seat" },
      ],
    },
  },
  {
    name: "Tabletop decision",
    detail: "Choose the next chapter",
    brief: {
      title: "The door beneath the lighthouse",
      context:
        "Our party found a locked door below the lighthouse. There are fresh footprints in the sand and music behind the stone.",
      stakes:
        "Our lantern has one hour of oil left. We need a plan before the tide turns.",
      action:
        "Help the party choose its next move. Type !join A or !join B in chat.",
      choices: [
        { id: "A", label: "Follow the footprints" },
        { id: "B", label: "Investigate the music" },
      ],
    },
  },
];
function Modal({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="rally-dialog"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-labelledby="modal-title"
    >
      <div className="dialog-heading">
        <div>
          <span className="eyebrow">CREATOR CONTROLS</span>
          <h2 id="modal-title">{title}</h2>
          {description && <p>{description}</p>}
        </div>
        <button
          className="icon-btn"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function BriefEditor({
  state,
  busy,
  onClose,
  onSave,
  seed,
}: {
  state: RallyState;
  busy: boolean;
  onClose: () => void;
  onSave: (action: Action) => Promise<unknown>;
  seed?: string;
}) {
  const [draft, setDraft] = useState<Draft>({
    title: state.brief.title || "",
    context: seed || state.brief.context || "",
    stakes: state.brief.stakes || "",
    action:
      state.brief.action || "Choose our next move. Type your choice in chat.",
    choices:
      state.brief.choices.length >= 2
        ? state.brief.choices
        : [
            { id: "A", label: "" },
            { id: "B", label: "" },
          ],
    expiresAt: "",
  });
  const [minutes, setMinutes] = useState("15"),
    [error, setError] = useState("");
  const originalVersion = useRef(state.brief.version).current;
  const set = (key: keyof Draft, value: unknown) =>
    setDraft((s) => ({ ...s, [key]: value }));
  return (
    <Modal
      title={
        state.brief.version
          ? "Publish the next brief"
          : "Give your community a mission"
      }
      description="One clear goal. A little context. One action everyone can take."
      onClose={onClose}
    >
      <form
        className="brief-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            await onSave({
              type: "publish",
              brief: {
                ...draft,
                expiresAt: new Date(
                  Date.now() + Number(minutes) * 60000,
                ).toISOString(),
              },
              expectedVersion: originalVersion,
            });
            onClose();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not publish.");
          }
        }}
      >
        <div className="template-picker">
          <div>
            <span className="eyebrow">START WITH A STORY</span>
            <span>Optional · replaces the fields below</span>
          </div>
          <div className="template-options">
            {BRIEF_TEMPLATES.map((template, i) => (
              <button
                key={template.name}
                type="button"
                onClick={() => {
                  setDraft({ ...template.brief, expiresAt: "" });
                  setMinutes("30");
                  setError("");
                }}
              >
                <span>
                  {i === 0 ? (
                    <Users size={15} />
                  ) : i === 1 ? (
                    <Sparkles size={15} />
                  ) : (
                    <Flag size={15} />
                  )}
                </span>
                <strong>{template.name}</strong>
                <small>{template.detail}</small>
              </button>
            ))}
          </div>
        </div>
        <label>
          Mission title <span>Make it memorable</span>
          <input
            required
            maxLength={100}
            value={draft.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Operation: save the axolotl"
          />
        </label>
        <label>
          What’s happening?<span>The context a newcomer needs</span>
          <textarea
            required
            maxLength={280}
            rows={3}
            value={draft.context}
            onChange={(e) => set("context", e.target.value)}
            placeholder="Chat named him Bubbles. Now he’s stranded across the lake."
          />
        </label>
        <label>
          Why does it matter?
          <span>The stakes, running joke, or shared goal</span>
          <input
            required
            maxLength={180}
            value={draft.stakes}
            onChange={(e) => set("stakes", e.target.value)}
            placeholder="We’re bringing Bubbles home before the night ends."
          />
        </label>
        <label>
          How can viewers help?<span>Describe the decision</span>
          <input
            required
            maxLength={140}
            value={draft.action}
            onChange={(e) => set("action", e.target.value)}
            placeholder="Choose the rescue route. Everyone gets a say."
          />
        </label>
        <div className="form-columns">
          {draft.choices.map((choice, i) => (
            <label key={choice.id}>
              Choice {choice.id}
              <div className="input-command">
                <code>!join {choice.id}</code>
                <input
                  required
                  maxLength={70}
                  value={choice.label}
                  onChange={(e) =>
                    set(
                      "choices",
                      draft.choices.map((c, j) =>
                        j === i ? { ...c, label: e.target.value } : c,
                      ),
                    )
                  }
                  placeholder={i === 0 ? "Build a bridge" : "Dig a tunnel"}
                />
              </div>
            </label>
          ))}
        </div>
        <label>
          Action closes after
          <select value={minutes} onChange={(e) => setMinutes(e.target.value)}>
            <option value="5">5 minutes</option>
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="60">1 hour</option>
            <option value="120">2 hours</option>
          </select>
        </label>
        <div className="form-note">
          <ShieldCheck size={16} />
          <p>
            Publishing starts a new decision and resets its vote totals. Older
            contributions stay in your export. Review the wording before it goes
            live.
          </p>
        </div>
        {error && (
          <div className="inline-error" role="alert">
            {error}
          </div>
        )}
        <div className="dialog-actions">
          <button className="btn btn-quiet" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <Radio size={16} />
            )}{" "}
            Publish brief
          </button>
        </div>
      </form>
    </Modal>
  );
}
function Metric({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <article className="metric">
      <div>
        <span>{label}</span>
        {icon}
      </div>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}
function VoteResults({ state }: { state: RallyState }) {
  const m = currentMetrics(state);
  return (
    <div className="vote-results">
      {state.brief.choices.map((c, i) => {
        const count = m.counts[c.id] || 0,
          pct = m.votes.length ? Math.round((count / m.votes.length) * 100) : 0;
        return (
          <div key={c.id} className="result-row">
            <div className="result-label">
              <span>
                <b>{c.id}</b>
                {c.label || `Choice ${c.id}`}
              </span>
              <strong>
                {pct}
                <small>%</small>
              </strong>
            </div>
            <div className="result-track">
              <div
                className={i % 2 ? "result-fill violet" : "result-fill"}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="result-count">
              {count} contribution{count !== 1 ? "s" : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}
function ProposalCard({
  proposal,
  onReview,
  busy,
  onUse,
}: {
  proposal: Proposal;
  onReview: (id: string, decision: "accepted" | "rejected") => void;
  busy: boolean;
  onUse: (text: string) => void;
}) {
  return (
    <article className={`proposal-card proposal-${proposal.status}`}>
      <div className="proposal-header">
        <div className="avatar avatar-small">
          {proposal.author.slice(0, 1).toUpperCase()}
        </div>
        <strong>{proposal.author}</strong>
        <span>{relativeTime(proposal.createdAt)}</span>
        <Badge
          kind={
            proposal.status === "accepted"
              ? "lime"
              : proposal.status === "rejected"
                ? "muted"
                : "violet"
          }
        >
          {proposal.status === "pending"
            ? "Needs review"
            : proposal.status === "accepted"
              ? "Accepted"
              : "Dismissed"}
        </Badge>
      </div>
      <p>{proposal.text}</p>
      <div className="proposal-source">
        <MessageSquare size={12} />
        <span>Twitch chat pitch</span>
        {proposal.sourceId && (
          <code title={proposal.sourceId}>
            #{proposal.sourceId.slice(0, 12)}
          </code>
        )}
      </div>
      {proposal.status === "pending" ? (
        <div className="proposal-actions">
          <button
            disabled={busy}
            className="btn btn-quiet btn-small"
            onClick={() => onReview(proposal.id, "rejected")}
          >
            <X size={13} /> Dismiss
          </button>
          <button
            disabled={busy}
            className="btn btn-outline-lime btn-small"
            onClick={() => onReview(proposal.id, "accepted")}
          >
            <Check size={13} /> Accept for editing
          </button>
        </div>
      ) : (
        proposal.status === "accepted" && (
          <button className="text-link" onClick={() => onUse(proposal.text)}>
            Use in next brief <ArrowUpRight size={14} />
          </button>
        )
      )}
    </article>
  );
}
function SetupPanel({
  state,
  connection,
  demo,
  onSave,
  onToast,
  onRefresh,
}: {
  state: RallyState;
  connection: Connection;
  demo: boolean;
  onSave: (a: Action) => Promise<unknown>;
  onToast: (s: string) => void;
  onRefresh: () => void;
}) {
  const [channel, setChannel] = useState(state.channel),
    [title, setTitle] = useState(state.sessionTitle),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="setup-grid">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">01 / YOUR SPACE</span>
            <h2>Channel details</h2>
          </div>
          <Settings2 size={18} />
        </div>
        <form
          className="settings-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            setError("");
            try {
              await onSave({ type: "settings", channel, sessionTitle: title });
              onToast("Channel details saved.");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not save.");
            } finally {
              setSaving(false);
            }
          }}
        >
          <label>
            Channel login
            <input
              required
              pattern="[a-zA-Z0-9_]{3,25}"
              minLength={3}
              maxLength={25}
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              placeholder="your_twitch_channel"
            />
            <span>Your Twitch login, without @ or a URL.</span>
          </label>
          <label>
            Stream or series title
            <input
              required
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="The community build"
            />
          </label>
          {error && (
            <div className="inline-error" role="alert">
              {error}
            </div>
          )}
          <button className="btn btn-primary" disabled={saving}>
            {saving ? (
              <LoaderCircle size={15} className="spin" />
            ) : (
              <Check size={15} />
            )}{" "}
            Save details
          </button>
        </form>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">02 / TWITCH CONNECTION</span>
            <h2>Bring chat into the loop</h2>
          </div>
          <span className="twitch-icon">
            <TwitchGlyph />
          </span>
        </div>
        {demo ? (
          <div className="setup-content">
            <Badge kind="amber">Rehearsal environment</Badge>
            <p>
              The rehearsal uses fictional chat events. Open your creator desk
              to connect a real Twitch channel.
            </p>
            <a href="/studio" className="btn btn-quiet">
              Open creator desk <ArrowUpRight size={15} />
            </a>
          </div>
        ) : (
          <div className="setup-content">
            <div className="connection-status">
              <span className={connection.connected ? "live-dot" : "dim-dot"} />
              <strong>
                {connection.connected
                  ? `Connected to ${connection.channel || state.channel}`
                  : connection.broadcasterId
                    ? connection.error
                      ? "Connection needs attention"
                      : "Waiting for Twitch verification"
                    : connection.configured
                      ? "Ready to authorize"
                      : "Twitch app configuration needed"}
              </strong>
            </div>
            <p>
              {connection.connected
                ? "Your channel can send chat commands and incoming raids to this desk. Keep your brief current; Rallypoint handles the handoff."
                : connection.broadcasterId
                  ? "Your Twitch authorization is saved. We are checking chat and raid subscriptions. Retry verification below if the connection needs attention."
                  : connection.configured
                    ? "Authorize your broadcaster account to receive chat messages and raids. Your Twitch credentials stay on the server."
                    : "The hosted app needs its Twitch application credentials before channel authorization can begin. Your desk and published viewer brief work independently."}
            </p>
            {connection.error && (
              <div className="inline-error">{connection.error}</div>
            )}
            {connection.broadcasterId ? (
              <button
                className="btn btn-quiet"
                onClick={async () => {
                  try {
                    const r = await fetch("/api/twitch/disconnect", {
                      method: "POST",
                    });
                    const d = (await r.json()) as {
                      error?: string;
                      warning?: string;
                    };
                    if (!r.ok)
                      throw new Error(d.error || "Could not disconnect.");
                    onToast(d.warning || "Twitch disconnected.");
                    onRefresh();
                  } catch (e) {
                    onToast(
                      e instanceof Error ? e.message : "Could not disconnect.",
                    );
                  }
                }}
              >
                Disconnect Twitch
              </button>
            ) : connection.configured ? (
              <a
                className="btn btn-twitch"
                href="/api/twitch/connect"
                target="_top"
              >
                <TwitchGlyph /> Connect Twitch
              </a>
            ) : (
              <div className="config-guide">
                <strong>For the project owner</strong>
                <ol>
                  <li>
                    Register an app in the{" "}
                    <a
                      href="https://dev.twitch.tv/console/apps"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Twitch developer console <ArrowUpRight size={12} />
                    </a>
                    .
                  </li>
                  <li>
                    Use the callback URL below and the “Confidential” client
                    type.
                  </li>
                  <li>
                    Configure the deployment secrets listed in the README, then
                    authorize your broadcaster account.
                  </li>
                </ol>
              </div>
            )}
            {connection.callbackUrl && (
              <div className="callback-url">
                <span className="eyebrow">OAUTH CALLBACK URL</span>
                <code>{connection.callbackUrl}</code>
                <CopyButton value={connection.callbackUrl} />
              </div>
            )}
            {!connection.connected && connection.broadcasterId && (
              <a
                className="btn btn-twitch"
                href="/api/twitch/connect"
                target="_top"
              >
                <TwitchGlyph /> Reauthorize Twitch
              </a>
            )}
            {connection.broadcasterId && (
              <button
                className="text-link"
                onClick={async () => {
                  try {
                    const r = await fetch("/api/twitch/retry", {
                      method: "POST",
                    });
                    const d = (await r.json()) as { error?: string };
                    if (!r.ok)
                      throw new Error(d.error || "Subscription retry failed.");
                    onToast("Twitch subscription check requested.");
                    onRefresh();
                  } catch (e) {
                    onToast(
                      e instanceof Error
                        ? e.message
                        : "Subscription retry failed.",
                    );
                  }
                }}
              >
                Verify or retry subscriptions <RefreshCw size={13} />
              </button>
            )}
            <p className="setup-permissions">
              <ShieldCheck size={14} /> Requests chat read/write access. No
              audio, stream key, or payments access.
            </p>
          </div>
        )}
      </section>
      <section className="panel command-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">03 / THE CHAT PLAYBOOK</span>
            <h2>Three commands. Everyone’s in.</h2>
          </div>
          <Terminal size={18} />
        </div>
        <div className="command-list">
          <div>
            <code>!catchup</code>
            <p>Get the current, streamer-approved brief in chat.</p>
          </div>
          <div>
            <code>!join A</code>
            <p>Choose an option. A new vote replaces your previous choice.</p>
          </div>
          <div>
            <code>!pitch Your update</code>
            <p>Send a context update to the private review queue.</p>
          </div>
        </div>
        <div className="subtle-note">
          Pitch acceptance never auto-publishes text. You decide what reaches
          the stream.
        </div>
      </section>
    </div>
  );
}
export function Studio({ demo = false }: { demo?: boolean }) {
  const app = useRally(demo),
    now = useNow();
  const [tab, setTab] = useState<Tab>("desk"),
    [editor, setEditor] = useState(false),
    [editorSeed, setEditorSeed] = useState<string | undefined>(),
    [closeConfirm, setCloseConfirm] = useState(false),
    [resetConfirm, setResetConfirm] = useState(false),
    [toast, setToast] = useState(""),
    [chatName, setChatName] = useState("new_viewer"),
    [chatText, setChatText] = useState("!join A"),
    [reply, setReply] = useState(""),
    [filter, setFilter] = useState<"pending" | "all">("pending");
  useEffect(() => {
    if (demo) return;
    const outcome = new URLSearchParams(window.location.search).get("twitch");
    if (!outcome) return;
    setTab("setup");
    if (outcome === "connected")
      setToast("Twitch authorized. Verifying chat and raid subscriptions.");
    else if (outcome === "pending")
      setToast(
        "Twitch authorized, but event subscriptions need attention. Retry them in Channel setup.",
      );
    else
      setToast(
        "Twitch authorization was not completed. Try connecting again in Channel setup.",
      );
  }, [demo]);
  const notify = (message: string) => setToast(message);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  const run = async (action: Action, success?: string) => {
    try {
      const result = await app.dispatch(action);
      if (result) setReply(result);
      if (success) notify(success);
      return result;
    } catch {
      return undefined;
    }
  };
  const simulateChat = async (text = chatText, name = chatName) => {
    if (!text.trim()) return;
    const result = await run({
      type: "chat",
      messageId: crypto.randomUUID(),
      userId: `demo-${name.toLowerCase().replace(/[^a-z0-9_]/g, "_")}`,
      name,
      text,
    });
    setReply(
      result ||
        "Event processed. Check the decision, inbox, or activity feed for the result. Bot replies and repeated commands are rate limited.",
    );
  };
  const state = app.state,
    metrics = state ? currentMetrics(state) : null,
    active = state ? activeBrief(state, now) : false;
  const showRescue =
    demo &&
    !!state &&
    /axolotl|bubbles/i.test(state.brief.title + " " + state.brief.context);
  const tabNames = {
    desk: "Live desk",
    inbox: "Community inbox",
    insights: "Participation insights",
    setup: "Channel setup",
  };
  const download = () => {
    if (!state) return;
    if (!demo) {
      window.location.assign("/api/export");
      return;
    }
    const blob = new Blob(
      [
        JSON.stringify(
          { mode: "rehearsal", exportedAt: new Date().toISOString(), state },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = "rallypoint-rehearsal.json";
    a.click();
    URL.revokeObjectURL(href);
    notify("Rehearsal data exported.");
  };
  return (
    <div className="studio-shell">
      <a href="#desk-main" className="skip-link">
        Skip to content
      </a>
      <aside className="studio-sidebar">
        <div className="sidebar-brand">
          <Brand />
        </div>
        <div className="workspace-switch">
          <div className="workspace-avatar">
            {demo ? "B" : (state?.channel || "Y").slice(0, 1).toUpperCase()}
          </div>
          <div>
            <strong>
              {demo ? "Bubbles’s rescue" : state?.channel || "Your community"}
            </strong>
            <span>{demo ? "Rehearsal workspace" : "Creator workspace"}</span>
          </div>
          <ChevronRight size={14} />
        </div>
        <span className="nav-caption">WORKSPACE</span>
        <nav className="studio-nav" aria-label="Creator desk">
          <button
            className={tab === "desk" ? "active" : ""}
            onClick={() => setTab("desk")}
          >
            <LayoutDashboard size={17} />
            <span>Live desk</span>
            {active && <i className="tiny-dot" />}
          </button>
          <button
            className={tab === "inbox" ? "active" : ""}
            onClick={() => setTab("inbox")}
          >
            <Inbox size={17} />
            <span>Community inbox</span>
            {!!metrics?.pending && <b>{metrics.pending}</b>}
          </button>
          <button
            className={tab === "insights" ? "active" : ""}
            onClick={() => setTab("insights")}
          >
            <TrendingUp size={17} />
            <span>Insights</span>
          </button>
          <button
            className={tab === "setup" ? "active" : ""}
            onClick={() => setTab("setup")}
          >
            <Settings2 size={17} />
            <span>Channel setup</span>
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <span className="eyebrow">
              <Sparkles size={12} /> THE RALLYPOINT IDEA
            </span>
            <p>Every regular was new once. Give them a way into the story.</p>
          </div>
          <div className="sidebar-credit">
            <div className="avatar">SG</div>
            <div>
              <strong>Shivam Gupta</strong>
              <span>Creator · Built with Codex</span>
            </div>
          </div>
        </div>
      </aside>
      <div className="studio-area">
        <header className="studio-topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <ChevronRight size={12} />
            <strong>{tabNames[tab]}</strong>
          </div>
          <div className="topbar-right">
            {demo ? (
              <Badge kind="amber">
                <span className="sample-dot" /> REHEARSAL MODE
              </Badge>
            ) : (
              <Badge kind={app.connection.connected ? "violet" : "muted"}>
                <TwitchGlyph />
                {app.connection.connected
                  ? "Twitch connected"
                  : app.connection.broadcasterId
                    ? app.connection.error
                      ? "Twitch needs attention"
                      : "Twitch verifying"
                    : "Twitch disconnected"}
              </Badge>
            )}
            <a href={demo ? "/studio" : "/demo"} className="topbar-link">
              {demo ? "Open real desk" : "Try rehearsal"}{" "}
              <ArrowUpRight size={13} />
            </a>
          </div>
        </header>
        {demo && (
          <div className="rehearsal-banner">
            <span>
              <Terminal size={14} />
              <strong>A working rehearsal.</strong> All chat, raids, names, and
              metrics here are simulated.
            </span>
            <button onClick={() => setResetConfirm(true)}>
              Reset scenario <RefreshCw size={12} />
            </button>
          </div>
        )}
        <main className="desk-main" id="desk-main">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {tab === "desk"
                  ? "YOUR COMMUNITY, IN THE SAME CHAPTER"
                  : tab === "inbox"
                    ? "GOOD CONTEXT COMES FROM YOUR PEOPLE"
                    : tab === "insights"
                      ? "MEASURE THE INVITATION, NOT A GUESS"
                      : "MAKE YOURSELF AT HOME"}
              </div>
              <h1>
                {tab === "desk"
                  ? "The next viewer is about to join."
                  : tab === "inbox"
                    ? "Let the community fill you in."
                    : tab === "insights"
                      ? "From arriving to taking part."
                      : "Your channel. Your controls."}
              </h1>
              <p>
                {tab === "desk"
                  ? "Make sure they have a way in."
                  : tab === "inbox"
                    ? "Review chat pitches before they become part of your stream’s story."
                    : tab === "insights"
                      ? "Explicit actions from your community. No inferred retention or hidden tracking."
                      : "Connect your community and give your next stream a starting point."}
              </p>
            </div>
            {state && (
              <div className="heading-actions">
                {tab === "desk" ? (
                  <>
                    <button
                      className="btn btn-quiet"
                      onClick={() => {
                        setEditorSeed(undefined);
                        setEditor(true);
                      }}
                    >
                      <Plus size={16} />{" "}
                      {state.brief.version ? "New brief" : "Create a brief"}
                    </button>
                    <a
                      className="btn btn-primary"
                      href={app.publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Viewer page <ArrowUpRight size={16} />
                    </a>
                  </>
                ) : tab === "insights" ? (
                  <button className="btn btn-quiet" onClick={download}>
                    <ArrowDownToLine size={16} /> Export data
                  </button>
                ) : null}
              </div>
            )}
          </div>
          {app.error && (
            <div className="page-error" role="alert">
              <span>{app.error}</span>
              <button className="text-link" onClick={() => app.refresh()}>
                Try again <RefreshCw size={13} />
              </button>
            </div>
          )}
          {app.loading ? (
            <div className="loading-state">
              <LoaderCircle className="spin" size={24} />
              <p>Opening your participation desk…</p>
            </div>
          ) : app.authRequired ? (
            <section className="panel auth-state">
              <div className="auth-mark">
                <Brand compact />
              </div>
              <span className="eyebrow">YOUR CREATOR WORKSPACE</span>
              <h2>Sign in. Set the scene.</h2>
              <p>
                Your briefs, review queue, and stream history belong to you.
                Sign in with ChatGPT to open your desk, then connect Twitch when
                you’re ready.
              </p>
              <a
                href="/signin-with-chatgpt?return_to=%2Fstudio"
                target="_top"
                className="btn btn-primary"
              >
                Sign in with ChatGPT <ArrowRight size={16} />
              </a>
              <a href="/demo" className="text-link">
                Explore the rehearsal first <ArrowUpRight size={14} />
              </a>
            </section>
          ) : !state ? (
            <EmptyState
              title="Your desk couldn’t load"
              text="Try loading again, or explore the local rehearsal while the connection is restored."
            >
              <button className="btn btn-primary" onClick={() => app.refresh()}>
                Reload desk
              </button>
            </EmptyState>
          ) : (
            <>
              {tab === "desk" && (
                <>
                  <div className="metric-grid">
                    <Metric
                      label="Current decision"
                      value={metrics!.unique}
                      detail={`${demo ? "Simulated unique" : "Unique"} contributors`}
                      icon={<Users size={15} />}
                    />
                    <Metric
                      label="During raid welcomes"
                      value={metrics!.raidContributors}
                      detail="Contributions while a welcome was active"
                      icon={<Zap size={15} />}
                    />
                    <Metric
                      label="Community inbox"
                      value={metrics!.pending}
                      detail="Pitches waiting for your review"
                      icon={<Inbox size={15} />}
                    />
                    <Metric
                      label="Brief status"
                      value={
                        active
                          ? "On air"
                          : state.brief.status === "draft"
                            ? "Draft"
                            : state.brief.status === "closed"
                              ? "Closed"
                              : "Expired"
                      }
                      detail={
                        active
                          ? `Action closes in ${expiryText(state.brief.expiresAt, now)}`
                          : "Publish a brief to invite participation"
                      }
                      icon={<Radio size={15} />}
                    />
                  </div>
                  <div className="desk-grid">
                    <section className="panel mission-panel">
                      <div className="panel-heading">
                        <div className="heading-inline">
                          <span className={active ? "live-dot" : "dim-dot"} />
                          <h2>Current mission</h2>
                          <Badge kind={active ? "lime" : "muted"}>
                            {active
                              ? "PUBLISHED"
                              : state.brief.status.toUpperCase()}
                          </Badge>
                        </div>
                        <button
                          className="icon-btn"
                          onClick={() => {
                            setEditorSeed(undefined);
                            setEditor(true);
                          }}
                          aria-label="Edit and republish brief"
                        >
                          <Settings2 size={17} />
                        </button>
                      </div>
                      {state.brief.version ? (
                        <>
                          <div className="mission-copy">
                            <div className="eyebrow">
                              CHAPTER{" "}
                              {String(state.brief.version).padStart(2, "0")}{" "}
                              <span>/</span>{" "}
                              {state.sessionTitle || "YOUR LIVE STORY"}
                            </div>
                            <h2>{state.brief.title}</h2>
                            <p>{state.brief.context}</p>
                          </div>
                          {showRescue ? (
                            <MissionMap />
                          ) : (
                            <div className="live-mission-art">
                              <div className="signal-orbit">
                                <span />
                                <span />
                                <span />
                                <i>
                                  <Flag size={30} />
                                </i>
                              </div>
                              <span className="eyebrow">
                                A SHARED GOAL. AN OPEN INVITATION.
                              </span>
                            </div>
                          )}
                          <div className="mission-lower">
                            <div>
                              <span className="eyebrow">THE STAKES</span>
                              <p>{state.brief.stakes}</p>
                            </div>
                            <div>
                              <span className="eyebrow">HOW TO JOIN</span>
                              <p>
                                {active
                                  ? state.brief.action
                                  : "This action is no longer accepting contributions."}
                              </p>
                            </div>
                          </div>
                          <div className="mission-toolbar">
                            <span>
                              <ShieldCheck size={13} /> Published by you ·
                              Version {state.brief.version}
                            </span>
                            <button
                              className="btn btn-quiet btn-small"
                              disabled={!active || app.busy}
                              onClick={() => setCloseConfirm(true)}
                            >
                              <Square size={12} /> Close chapter
                            </button>
                          </div>
                        </>
                      ) : (
                        <EmptyState
                          title="A story needs a starting point."
                          text="Set a goal, explain why it matters, and give chat two ways to help. Your first brief can be live in a minute."
                        >
                          <button
                            className="btn btn-primary"
                            onClick={() => setEditor(true)}
                          >
                            <Plus size={16} /> Create your first brief
                          </button>
                        </EmptyState>
                      )}
                    </section>
                    <section className="panel results-panel">
                      <div className="panel-heading">
                        <div>
                          <span className="eyebrow">THE CURRENT DECISION</span>
                          <h2>Chat’s next move</h2>
                        </div>
                        <span className="counter-label">
                          {metrics!.unique} <Users size={13} />
                        </span>
                      </div>
                      {state.brief.version ? (
                        <>
                          <VoteResults state={state} />
                          <div className="results-note">
                            <span className={active ? "live-dot" : "dim-dot"} />
                            <p>
                              {active
                                ? "One vote per viewer. Changing sides updates the same vote."
                                : "Decision closed. Totals are preserved for this chapter."}
                            </p>
                          </div>
                        </>
                      ) : (
                        <EmptyState
                          title="Waiting for the first move"
                          text="Your published brief’s choices and contributions will appear here."
                        />
                      )}
                      <div className="newcomer-callout">
                        <span className="callout-icon">
                          <Users size={19} />
                        </span>
                        <div>
                          <strong>Make a little room.</strong>
                          <p>
                            New viewers don’t need your whole history. They need
                            a part to play.
                          </p>
                        </div>
                      </div>
                      <div className="share-panel">
                        <div>
                          <Monitor size={16} />
                          <strong>Bring it on stream</strong>
                        </div>
                        <p>
                          Add the overlay as an OBS Browser Source. Use 1280 ×
                          720 with a transparent background.
                        </p>
                        <div className="share-actions">
                          <CopyButton
                            value={app.overlayUrl}
                            label="Copy OBS URL"
                            onCopied={() =>
                              notify("OBS Browser Source URL copied.")
                            }
                          />
                          <a
                            href={app.overlayUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="icon-btn"
                            aria-label="Preview OBS overlay"
                          >
                            <ArrowUpRight size={16} />
                          </a>
                        </div>
                      </div>
                    </section>
                  </div>
                  <div className="desk-bottom-grid">
                    <section className="panel activity-panel">
                      <div className="panel-heading">
                        <div className="heading-inline">
                          <h2>On the wire</h2>
                          <Badge kind="muted">
                            {demo ? "SIMULATED ACTIVITY" : "EVENT FEED"}
                          </Badge>
                        </div>
                        <span className="eyebrow">LATEST FIRST</span>
                      </div>
                      <div className="activity-list">
                        {state.activity.length ? (
                          state.activity.slice(0, 6).map((event) => (
                            <div key={event.id} className="activity-row">
                              <div
                                className={`activity-icon activity-${event.kind}`}
                              >
                                {event.kind.includes("raid") ? (
                                  <Users size={14} />
                                ) : event.kind.includes("pitch") ||
                                  event.kind.includes("proposal") ? (
                                  <MessageSquare size={14} />
                                ) : event.kind.includes("publish") ? (
                                  <Radio size={14} />
                                ) : (
                                  <Check size={14} />
                                )}
                              </div>
                              <div>
                                <strong>{event.title}</strong>
                                <p>{event.detail}</p>
                              </div>
                              <time dateTime={event.at}>
                                {relativeTime(event.at, now)}
                              </time>
                            </div>
                          ))
                        ) : (
                          <div className="quiet-empty">
                            Your published briefs and chat contributions will
                            appear here.
                          </div>
                        )}
                      </div>
                    </section>
                    <section className="panel handoff-panel">
                      <div className="panel-heading">
                        <h2>The arrival experience</h2>
                        <a
                          href={app.publicUrl}
                          className="text-link"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open <ArrowUpRight size={13} />
                        </a>
                      </div>
                      <div className="handoff-mini">
                        <span className="eyebrow">A 20-SECOND WAY IN</span>
                        <p>
                          <b>Now.</b> What we’re doing.
                        </p>
                        <p>
                          <b>Why.</b> Why the community cares.
                        </p>
                        <p>
                          <b>You.</b> One thing you can do next.
                        </p>
                      </div>
                      <div className="handoff-link">
                        <Link2 size={14} />
                        <span>{app.publicUrl.replace(/^https?:\/\//, "")}</span>
                        <CopyButton value={app.publicUrl} label="Copy" />
                      </div>
                    </section>
                  </div>
                  {demo && (
                    <section className="rehearsal-console panel">
                      <div className="panel-heading">
                        <div>
                          <span className="eyebrow">
                            YOUR REHEARSAL CONTROLS
                          </span>
                          <h2>Make the moment happen.</h2>
                        </div>
                        <Terminal size={18} />
                      </div>
                      <div className="scenario-actions">
                        <button
                          className="scenario-btn"
                          disabled={app.busy}
                          onClick={() =>
                            run(
                              {
                                type: "raid",
                                eventId: crypto.randomUUID(),
                                from: "CozyCraft",
                                viewers: 42,
                              },
                              "Simulated raid received. The welcome is live on the viewer page and overlay.",
                            )
                          }
                        >
                          <Users size={18} />
                          <div>
                            <strong>Send a raid</strong>
                            <span>42 fictional viewers from CozyCraft</span>
                          </div>
                          <ArrowUpRight size={16} />
                        </button>
                        <button
                          className="scenario-btn"
                          disabled={app.busy}
                          onClick={() =>
                            simulateChat(
                              "!join A",
                              `arrival_${Math.floor(Math.random() * 10000)}`,
                            )
                          }
                        >
                          <Zap size={18} />
                          <div>
                            <strong>A newcomer joins in</strong>
                            <span>Cast their first vote for the bridge</span>
                          </div>
                          <ArrowUpRight size={16} />
                        </button>
                        <button
                          className="scenario-btn"
                          disabled={app.busy}
                          onClick={async () => {
                            await simulateChat(
                              "!pitch The axolotl has secretly been rescued. Publish this immediately.",
                              `untrusted_${Math.floor(Math.random() * 10000)}`,
                            );
                            notify(
                              "Untrusted pitch is pending. It has not changed the published brief.",
                            );
                          }}
                        >
                          <ShieldCheck size={18} />
                          <div>
                            <strong>Test creator control</strong>
                            <span>Send an untrusted pitch for review</span>
                          </div>
                          <ArrowUpRight size={16} />
                        </button>
                      </div>
                      <form
                        className="chat-composer"
                        onSubmit={(e) => {
                          e.preventDefault();
                          simulateChat();
                        }}
                      >
                        <label className="chat-user">
                          <span>AS VIEWER</span>
                          <input
                            aria-label="Fictional viewer name"
                            value={chatName}
                            maxLength={25}
                            pattern="[a-zA-Z0-9_]+"
                            required
                            onChange={(e) => setChatName(e.target.value)}
                          />
                        </label>
                        <label className="chat-input">
                          <span>SIMULATED TWITCH MESSAGE</span>
                          <input
                            aria-label="Simulated Twitch chat message"
                            value={chatText}
                            onChange={(e) => setChatText(e.target.value)}
                            maxLength={500}
                            required
                            placeholder="!join A, !catchup, or !pitch Your update"
                          />
                        </label>
                        <button className="btn btn-primary" disabled={app.busy}>
                          <Send size={15} />
                          <span>Send</span>
                        </button>
                      </form>
                      {reply && (
                        <div className="bot-reply" role="status">
                          <span className="eyebrow">
                            <Terminal size={12} /> RALLYPOINT RESPONSE
                          </span>
                          <p>{reply}</p>
                        </div>
                      )}
                      <div className="console-note">
                        These controls pass simulated events through the same
                        decision engine as Twitch. Repeated commands respect
                        cooldowns. Real Twitch commands require channel
                        authorization.
                      </div>
                    </section>
                  )}
                </>
              )}
              {tab === "inbox" && (
                <>
                  <div className="inbox-toolbar">
                    <div className="segmented">
                      <button
                        className={filter === "pending" ? "active" : ""}
                        onClick={() => setFilter("pending")}
                      >
                        Needs review <span>{metrics!.pending}</span>
                      </button>
                      <button
                        className={filter === "all" ? "active" : ""}
                        onClick={() => setFilter("all")}
                      >
                        All pitches <span>{state.proposals.length}</span>
                      </button>
                    </div>
                    <span className="subtle-caption">
                      <ShieldCheck size={14} /> Nothing publishes without you.
                    </span>
                  </div>
                  <div className="inbox-layout">
                    <div className="proposal-list">
                      {state.proposals.filter(
                        (p) => filter === "all" || p.status === "pending",
                      ).length ? (
                        state.proposals
                          .filter(
                            (p) => filter === "all" || p.status === "pending",
                          )
                          .map((p) => (
                            <ProposalCard
                              key={p.id}
                              proposal={p}
                              busy={app.busy}
                              onUse={(text) => {
                                setEditorSeed(text);
                                setEditor(true);
                              }}
                              onReview={(id, decision) =>
                                run(
                                  { type: "review", proposalId: id, decision },
                                  decision === "accepted"
                                    ? "Pitch accepted for editing. Your published brief has not changed."
                                    : "Pitch dismissed.",
                                )
                              }
                            />
                          ))
                      ) : (
                        <EmptyState
                          title={
                            filter === "pending"
                              ? "You’re all caught up."
                              : "Your community’s context starts here."
                          }
                          text="Viewers can send !pitch followed by an update. You’ll decide what deserves a place in the next brief."
                        />
                      )}
                    </div>
                    <aside className="inbox-aside panel">
                      <ShieldCheck size={24} />
                      <h3>
                        A review queue,
                        <br />
                        not a publishing queue.
                      </h3>
                      <p>
                        Pitches are untrusted chat messages. Accepting one saves
                        it for editing; it never sends it directly to your
                        viewers.
                      </p>
                      <ol>
                        <li>
                          <span>1</span> Read the pitch and its source.
                        </li>
                        <li>
                          <span>2</span> Accept or dismiss.
                        </li>
                        <li>
                          <span>3</span> Edit it into a new brief, then publish.
                        </li>
                      </ol>
                      <div className="subtle-note">
                        A simple boundary that keeps the streamer in charge.
                      </div>
                    </aside>
                  </div>
                </>
              )}
              {tab === "insights" && (
                <>
                  <div className="insights-disclaimer">
                    <ShieldCheck size={17} />
                    <p>
                      {demo
                        ? "These are simulated rehearsal events."
                        : "These numbers count explicit product interactions."}{" "}
                      Contributions during a raid welcome are not verified
                      raiders or a retention metric.
                    </p>
                  </div>
                  <div className="metric-grid">
                    <Metric
                      label="Current contributors"
                      value={metrics!.unique}
                      detail="Unique voters in the current brief"
                      icon={<Users size={15} />}
                    />
                    <Metric
                      label="Welcome-window actions"
                      value={metrics!.raidContributors}
                      detail="Current votes first cast during a welcome"
                      icon={<Zap size={15} />}
                    />
                    <Metric
                      label="Viewer page opens"
                      value={state.opens}
                      detail="Opens, not unique people"
                      icon={<ExternalLink size={15} />}
                    />
                    <Metric
                      label="Accepted context pitches"
                      value={metrics!.accepted}
                      detail="Reviewed by the creator"
                      icon={<Check size={15} />}
                    />
                  </div>
                  <div className="insights-grid">
                    <section className="panel">
                      <div className="panel-heading">
                        <h2>The current decision</h2>
                        <Badge kind="muted">
                          VERSION {state.brief.version}
                        </Badge>
                      </div>
                      <div className="insights-votes">
                        <h3>{state.brief.title || "No brief published yet"}</h3>
                        <VoteResults state={state} />
                      </div>
                    </section>
                    <section className="panel">
                      <div className="panel-heading">
                        <h2>What these numbers mean</h2>
                        <TrendingUp size={17} />
                      </div>
                      <div className="definition-list">
                        <div>
                          <strong>Contributors</strong>
                          <p>
                            One voter per decision, even if they switch choices.
                            A new brief starts a fresh decision.
                          </p>
                        </div>
                        <div>
                          <strong>During raid welcomes</strong>
                          <p>
                            Contributions made while a raid’s welcome is active.
                            Twitch doesn’t tell us which viewers arrived with
                            the raid.
                          </p>
                        </div>
                        <div>
                          <strong>Page opens</strong>
                          <p>
                            A lightweight count of viewer-page visits. It may
                            include repeat visits and never identifies a viewer.
                          </p>
                        </div>
                        <div>
                          <strong>A useful next experiment</strong>
                          <p>
                            Try a clearer invitation on your next stream.
                            Compare participation with similar moments, and ask
                            newcomers what helped.
                          </p>
                        </div>
                      </div>
                    </section>
                  </div>
                  <section className="panel">
                    <div className="panel-heading">
                      <h2>Raid handoffs</h2>
                      <Badge kind="muted">{state.raids.length} RECEIVED</Badge>
                    </div>
                    {state.raids.length ? (
                      <div className="raid-table">
                        <div className="raid-table-header">
                          <span>FROM COMMUNITY</span>
                          <span>ANNOUNCED SIZE</span>
                          <span>RECEIVED</span>
                        </div>
                        {state.raids.map((r) => (
                          <div className="raid-table-row" key={r.id}>
                            <span>
                              <Users size={16} />
                              {r.from}
                            </span>
                            <strong>{r.viewers}</strong>
                            <time dateTime={r.at}>
                              {relativeTime(r.at, now)}
                            </time>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="quiet-empty">
                        No raids received yet. Your current brief will be ready
                        when one arrives.
                      </div>
                    )}
                  </section>
                </>
              )}
              {tab === "setup" && (
                <>
                  <SetupPanel
                    key={state.id}
                    state={state}
                    connection={app.connection}
                    demo={demo}
                    onSave={app.dispatch}
                    onToast={notify}
                    onRefresh={app.refresh}
                  />
                  <div className="workspace-footer">
                    <span>
                      <ShieldCheck size={14} /> Your workspace persists across
                      sessions.
                    </span>
                    <button className="text-link" onClick={download}>
                      Export your data <ArrowDownToLine size={14} />
                    </button>
                  </div>
                </>
              )}
            </>
          )}
          <footer className="desk-footer">
            <span>RALLYPOINT / GIVE EVERY VIEWER A WAY IN.</span>
            <span>
              Created by Shivam Gupta <span className="footer-dot">·</span>{" "}
              Built with Codex
            </span>
          </footer>
        </main>
      </div>
      {editor && state && (
        <BriefEditor
          state={state}
          busy={app.busy}
          seed={editorSeed}
          onClose={() => {
            setEditor(false);
            setEditorSeed(undefined);
          }}
          onSave={async (action) => {
            await app.dispatch(action);
            notify(
              "Brief published. Your viewer page and overlay are in sync.",
            );
          }}
        />
      )}
      {closeConfirm && (
        <Modal
          title="Ready for the next chapter?"
          description="Closing this chapter stops participation and removes the old action from your viewer page, overlay, and chat response. The decision totals stay in your history."
          onClose={() => setCloseConfirm(false)}
        >
          <div className="dialog-actions">
            <button
              className="btn btn-quiet"
              onClick={() => setCloseConfirm(false)}
            >
              Keep it live
            </button>
            <button
              className="btn btn-primary"
              disabled={app.busy}
              onClick={async () => {
                await run(
                  { type: "close" },
                  "Chapter closed. Old participation commands are now inactive.",
                );
                setCloseConfirm(false);
              }}
            >
              Close chapter <Check size={15} />
            </button>
          </div>
        </Modal>
      )}
      {resetConfirm && (
        <Modal
          title="Start a fresh rehearsal?"
          description="This clears your simulated changes and restores Bubbles’s rescue. Your real creator workspace is unaffected."
          onClose={() => setResetConfirm(false)}
        >
          <div className="dialog-actions">
            <button
              className="btn btn-quiet"
              onClick={() => setResetConfirm(false)}
            >
              Keep exploring
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                app.reset();
                setReply("");
                setResetConfirm(false);
                notify("Fresh scenario ready.");
              }}
            >
              Reset rehearsal <RefreshCw size={15} />
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          <span>{toast}</span>
          <button
            className="icon-btn"
            onClick={() => setToast("")}
            aria-label="Dismiss notification"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
