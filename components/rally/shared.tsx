"use client";

import {
  ArrowUpRight,
  Radio,
  Copy,
  Check,
  Clock3,
  Users,
  ArrowRight,
} from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { RallyState } from "@/lib/rally/types";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="brand" aria-label="Rallypoint home">
      <span className="brand-mark" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      {!compact && (
        <span>
          rallypoint<span className="brand-period">.</span>
        </span>
      )}
    </Link>
  );
}
export function TwitchGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M4 2 2.5 6v14h5v3l3-3h4l7-7V2H4Zm15 10-4 4h-4l-3 3v-3H5V4h14v8Z" />
      <path d="M10 7h2v5h-2zm5 0h2v5h-2z" />
    </svg>
  );
}
export function Badge({
  children,
  kind = "muted",
}: {
  children: React.ReactNode;
  kind?: string;
}) {
  return <span className={`badge badge-${kind}`}>{children}</span>;
}
export function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}
export function activeBrief(state: RallyState, now = Date.now()) {
  return (
    state.brief.status === "live" &&
    new Date(state.brief.expiresAt).getTime() > now
  );
}
export function relativeTime(at: string, now = Date.now()) {
  const sec = Math.max(0, Math.floor((now - new Date(at).getTime()) / 1000));
  return sec < 60
    ? "just now"
    : sec < 3600
      ? `${Math.floor(sec / 60)}m ago`
      : `${Math.floor(sec / 3600)}h ago`;
}
export function expiryText(at: string, now = Date.now()) {
  const sec = Math.ceil((new Date(at).getTime() - now) / 1000);
  if (sec <= 0) return "Expired";
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}
export function currentMetrics(state: RallyState) {
  const projected = (
    state as RallyState & {
      publicMetrics?: {
        currentContributors: number;
        counts: Record<string, number>;
        raidWindowContributors: number;
        totalContributors: number;
      };
    }
  ).publicMetrics;
  if (projected)
    return {
      votes: { length: projected.currentContributors },
      unique: projected.currentContributors,
      raidContributors: projected.raidWindowContributors,
      counts: projected.counts,
      accepted: 0,
      pending: 0,
    };
  const votes = state.contributions.filter(
    (v) => v.version === state.brief.version,
  );
  const unique = new Set(votes.map((v) => v.userId || v.id)).size;
  return {
    votes,
    unique,
    raidContributors: votes.filter((v) => v.raidId).length,
    accepted: state.proposals.filter((p) => p.status === "accepted").length,
    pending: state.proposals.filter((p) => p.status === "pending").length,
    counts: Object.fromEntries(
      state.brief.choices.map((c) => [
        c.id,
        votes.filter((v) => v.choiceId === c.id).length,
      ]),
    ),
  };
}
export function CopyButton({
  value,
  label = "Copy link",
  onCopied,
}: {
  value: string;
  label?: string;
  onCopied?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <>
      <button
        className="btn btn-quiet btn-small"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            onCopied?.();
            setTimeout(() => setCopied(false), 1800);
          } catch {
            setFailed(true);
          }
        }}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}{" "}
        {copied ? "Copied" : label}
      </button>
      {failed && (
        <input
          className="copy-fallback"
          aria-label="Copy this link manually"
          readOnly
          value={value}
          onFocus={(e) => e.target.select()}
        />
      )}
    </>
  );
}
export function MissionMap({ small = false }: { small?: boolean }) {
  return (
    <div
      className={`mission-map ${small ? "map-small" : ""}`}
      aria-label="Illustration of two rescue routes: a bridge above water or a tunnel below"
    >
      <div className="map-grid" />
      <span className="map-label map-label-top">SECTOR 04 / THE DEEP END</span>
      <span className="map-compass">N ↑</span>
      <svg
        viewBox="0 0 680 320"
        role="img"
        aria-label="Bridge and tunnel rescue map"
        className="terrain-svg"
      >
        <defs>
          <pattern
            id="waterlines"
            width="30"
            height="20"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M0 10h8m9 0h8"
              stroke="#487666"
              strokeWidth="1"
              opacity=".3"
            />
          </pattern>
          <linearGradient id="watertint" x1="0" x2="0" y1="0" y2="1">
            <stop stopColor="#255243" />
            <stop offset="1" stopColor="#142e27" />
          </linearGradient>
        </defs>
        <path
          d="M0 168h105v-18h85v21h75v15h90v-9h61v-19h73v13h69v-15h122v164H0Z"
          fill="url(#watertint)"
        />
        <path
          d="M0 168h105v-18h85v21h75v15h90v-9h61v-19h73v13h69v-15h122v164H0Z"
          fill="url(#waterlines)"
        />
        <path
          d="M0 131h110v-13h84v85h-20v37h-61v26H0zm486-16h85v16h109v145h-105v-29h-53v-42h-36Z"
          fill="#2a3028"
          stroke="#414b3b"
        />
        <path
          d="M0 129h110v-13h84m292-3h85v16h109"
          fill="none"
          stroke="#7d8b5e"
          strokeWidth="6"
        />
        <path
          d="M137 102h36v18h-36zm-56 9h25v17H81zm472-8h33v25h-33z"
          fill="#515d40"
        />
        <path
          d="M174 132h341"
          stroke="#d9f97d"
          strokeWidth="3"
          strokeDasharray="8 7"
        />
        <path
          d="m505 124 10 8-10 8"
          fill="none"
          stroke="#d9f97d"
          strokeWidth="3"
        />
        <path
          d="M158 218v52h371v-51"
          fill="none"
          stroke="#8f8bba"
          strokeWidth="3"
          strokeDasharray="6 7"
        />
        <path
          d="m521 229 8-10 8 10"
          fill="none"
          stroke="#8f8bba"
          strokeWidth="3"
        />
        <g className="map-creature">
          <path
            d="M320 181h13v-9h35v9h13v25h-13v10h-35v-10h-13Z"
            fill="#efa9c2"
          />
          <path
            d="M309 179h10v8h-10zm-7 13h17v7h-17zm80-13h10v8h-10zm0 13h17v7h-17z"
            fill="#b86d89"
          />
          <path d="M331 188h5v6h-5zm31 0h5v6h-5z" fill="#1d2220" />
          <path d="M344 202h9" stroke="#7e4e66" strokeWidth="3" />
        </g>
        <circle cx="158" cy="132" r="7" fill="#d9f97d" />
        <circle cx="529" cy="132" r="7" fill="#d9f97d" />
        <path
          d="M234 126v14m28-14v14m28-14v14m28-14v14m28-14v14m28-14v14m28-14v14m28-14v14m28-14v14"
          stroke="#8aa04f"
          strokeWidth="2"
        />
      </svg>
      <div className="route-label route-a">
        <span>A</span> BUILD A BRIDGE
      </div>
      <div className="route-label route-b">
        <span>B</span> DIG A TUNNEL
      </div>
      <div className="map-objective">
        <span className="tiny-dot" /> 1 AXOLOTL. 2 ROUTES. YOUR CALL.
      </div>
    </div>
  );
}
export function BriefCard({
  state,
  compact = false,
  overlay = false,
  paused = false,
  pauseReason,
}: {
  state: RallyState;
  compact?: boolean;
  overlay?: boolean;
  paused?: boolean;
  pauseReason?: string;
}) {
  const now = useNow(),
    active = !paused && activeBrief(state, now),
    metrics = currentMetrics(state);
  const raid = state.raids.find(
    (r) => new Date(r.welcomeUntil).getTime() > now,
  );
  return (
    <article
      className={`brief-card ${compact ? "brief-compact" : ""} ${overlay ? "brief-overlay" : ""}`}
    >
      {raid && (
        <div className="raid-banner">
          <Users size={15} />
          <span>Welcome, {raid.from}&apos;s community.</span>
          <span className="raid-count">{raid.viewers} raiders</span>
        </div>
      )}
      <div className="brief-top">
        <span className="eyebrow">
          <span className={active ? "live-dot" : "dim-dot"} />
          {paused
            ? pauseReason
              ? "CHAT CONNECTION PAUSED"
              : "AWAITING FRESH CONTEXT"
            : active
              ? "YOUR WAY IN"
              : "BETWEEN CHAPTERS"}
        </span>
        <span className="brief-version">
          {state.brief.version
            ? `V${String(state.brief.version).padStart(2, "0")}`
            : "DRAFT"}
        </span>
      </div>
      <h2>{state.brief.title || "The next story starts here."}</h2>
      {state.brief.context && (
        <p className="brief-context">{state.brief.context}</p>
      )}
      {state.brief.stakes && (
        <div className="brief-stakes">
          <span>THE STAKES</span>
          <p>{state.brief.stakes}</p>
        </div>
      )}
      {active ? (
        <>
          <div className="brief-action">
            <span className="eyebrow">YOU CAN HELP</span>
            <p>{state.brief.action}</p>
          </div>
          <div className="brief-choices">
            {state.brief.choices.map((c) => (
              <div key={c.id} className="brief-choice">
                <code>!join {c.id}</code>
                <span>{c.label}</span>
                {!compact && <b>{metrics.counts[c.id] || 0}</b>}
              </div>
            ))}
          </div>
          <div className="brief-footer">
            <span>
              <Clock3 size={12} /> Action closes in{" "}
              {expiryText(state.brief.expiresAt, now)}
            </span>
            <span>
              Type in Twitch chat <ArrowUpRight size={12} />
            </span>
          </div>
        </>
      ) : (
        <div className="brief-wait">
          <Clock3 size={16} />
          <p>
            {paused
              ? pauseReason ||
                "Waiting for a fresh brief. Participation commands are temporarily hidden."
              : state.brief.status === "closed"
                ? "This chapter is complete. The next mission is on its way."
                : state.brief.status === "live"
                  ? "This action has expired. Wait for the streamer’s next brief."
                  : "Your streamer is preparing a new participation brief."}
          </p>
        </div>
      )}
      {!overlay && (
        <div className="brief-trust">
          <Check size={12} />
          <span>
            Published by the streamer · Community context, creator control
          </span>
        </div>
      )}
    </article>
  );
}
export function EmptyState({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Radio size={24} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  );
}
export function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="text-link"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
      <ArrowUpRight size={14} />
    </a>
  );
}
export function GoArrow() {
  return <ArrowRight size={17} />;
}
