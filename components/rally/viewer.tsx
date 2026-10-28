"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Clock3,
  LoaderCircle,
  Monitor,
  Radio,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { RallyState } from "@/lib/rally/types";
import { transition } from "@/lib/rally/engine";
import {
  Brand,
  Badge,
  BriefCard,
  CopyButton,
  MissionMap,
  TwitchGlyph,
  activeBrief,
  currentMetrics,
  useNow,
} from "./shared";
import { readDemo, writeDemo } from "./use-rally";
function usePublicState(id: string, overlay: boolean) {
  const [state, setState] = useState<RallyState | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [lastSuccessAt, setLastSuccessAt] = useState(0);
  const demo = id === "demo";
  useEffect(() => {
    let stopped = false;
    let latestRevision = -1;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    // Clear the previous room while hydrating its browser-backed subscription.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setState(null);
    setError("");
    setLastSuccessAt(0);
    if (demo) {
      const sync = () => {
        setState(readDemo());
        setLoading(false);
      };
      let initial = readDemo();
      if (!overlay) initial = transition(initial, { type: "open" }).state;
      try {
        writeDemo(initial);
      } catch {}
      setState(initial);
      setLoading(false);
      window.addEventListener("storage", sync);
      window.addEventListener("rallypoint-demo", sync);
      return () => {
        window.removeEventListener("storage", sync);
        window.removeEventListener("rallypoint-demo", sync);
      };
    }
    const load = async () => {
      try {
        const response = await fetch(`/api/public/${encodeURIComponent(id)}`, {
          cache: "no-store",
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(8000),
          ]),
        });
        const data = (await response.json()) as {
          state: RallyState;
          error?: string;
        };
        if (!response.ok)
          throw new Error(data.error || "This brief could not be found.");
        if (!data.state || !Number.isInteger(data.state.revision))
          throw new Error("The latest brief could not be verified.");
        if (data.state.revision < latestRevision)
          throw new Error(
            "An older brief was received. Waiting for the current version.",
          );
        latestRevision = data.state.revision;
        if (!stopped) {
          setState((old) =>
            old && old.revision > data.state.revision ? old : data.state,
          );
          setLastSuccessAt(Date.now());
          setError("");
        }
      } catch (e) {
        if (!stopped)
          setError(
            e instanceof Error ? e.message : "The connection was interrupted.",
          );
      } finally {
        if (!stopped) {
          setLoading(false);
          timer = setTimeout(load, 3000);
        }
      }
    };
    load();
    if (!overlay) {
      let visitorKey = crypto.randomUUID();
      try {
        const saved = localStorage.getItem("rallypoint.viewer-id");
        if (saved && /^[A-Za-z0-9_-]{12,100}$/.test(saved)) visitorKey = saved;
        else localStorage.setItem("rallypoint.viewer-id", visitorKey);
      } catch {
        /* Opens remain approximate when browser storage is unavailable. */
      }
      fetch(`/api/public/${encodeURIComponent(id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorKey }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]),
      }).catch(() => {});
    }
    return () => {
      stopped = true;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [id, demo, overlay]);
  return { state, error, loading, demo, lastSuccessAt };
}
export function Viewer({
  id,
  overlay = false,
}: {
  id: string;
  overlay?: boolean;
}) {
  const { state, error, loading, demo, lastSuccessAt } = usePublicState(
      id,
      overlay,
    ),
    now = useNow();
  const fresh =
    demo || (!error && lastSuccessAt > 0 && now - lastSuccessAt <= 10000);
  const chatReady = demo || state?.chatReady === true;
  const connectionPaused = !chatReady && !!state && activeBrief(state, now);
  const pauseReason = connectionPaused
    ? "Twitch chat is not connected yet. Participation commands will appear when this channel is ready."
    : undefined;
  const metrics = state ? currentMetrics(state) : null,
    active = state ? fresh && chatReady && activeBrief(state, now) : false;
  const raid = fresh
    ? state?.raids.find((r) => new Date(r.welcomeUntil).getTime() > now)
    : undefined;
  if (overlay)
    return (
      <main className="overlay-root" aria-label="Rallypoint OBS overlay">
        {demo && (
          <div className="overlay-demo">
            <span className="sample-dot" /> SIMULATED REHEARSAL
          </div>
        )}
        {loading ? (
          <div className="overlay-status">
            <Radio size={15} /> Waiting for the participation brief…
          </div>
        ) : error || !fresh ? (
          <div className="overlay-status">
            <Clock3 size={15} />
            {state
              ? "Waiting for a fresh brief. Participation is paused."
              : error || "Verifying the latest brief…"}
          </div>
        ) : state ? (
          <div className="overlay-position">
            <div className="overlay-channel">
              <Brand compact />
              <span>
                {demo
                  ? "REHEARSAL"
                  : state.channel
                    ? `@${state.channel}`
                    : "YOUR COMMUNITY"}
              </span>
              <span className="overlay-channel-right">
                YOUR WAY INTO THE STORY
              </span>
            </div>
            <BriefCard
              state={state}
              compact
              overlay
              paused={connectionPaused}
              pauseReason={pauseReason}
            />
          </div>
        ) : null}
      </main>
    );
  return (
    <main className="viewer-root">
      <nav className="viewer-nav">
        <Brand />
        <div>
          <Badge kind={demo ? "amber" : active ? "lime" : "muted"}>
            {demo
              ? "REHEARSAL BRIEF"
              : active
                ? "CURRENT PARTICIPATION BRIEF"
                : connectionPaused
                  ? "CHAT CONNECTION PAUSED"
                  : "BETWEEN CHAPTERS"}
          </Badge>
          <a href={demo ? "/demo" : "/"} className="viewer-about">
            {demo ? "Back to rehearsal" : "About Rallypoint"}{" "}
            <ArrowUpRight size={14} />
          </a>
        </div>
      </nav>
      {demo && (
        <div className="viewer-demo-banner">
          <Monitor size={14} />
          <span>
            This is a simulated viewer experience. Update the brief in the
            rehearsal desk and watch it change here.
          </span>
          <a href="/demo">
            Open desk <ArrowUpRight size={13} />
          </a>
        </div>
      )}
      {loading ? (
        <div className="viewer-loading">
          <LoaderCircle size={25} className="spin" />
          <p>Finding your way into the story…</p>
        </div>
      ) : !state ? (
        <div className="viewer-not-found">
          <span className="eyebrow">THE STORY ISN’T HERE YET</span>
          <h1>{error || "No brief found."}</h1>
          <p>
            Ask the streamer for their current Rallypoint link, or explore a
            rehearsal to see how it works.
          </p>
          <a href="/demo" className="btn btn-primary">
            Try a rehearsal <ArrowRight size={16} />
          </a>
        </div>
      ) : (
        <>
          <div className="viewer-heading">
            <div className="eyebrow">
              <TwitchGlyph />{" "}
              {demo
                ? "FICTIONAL CHANNEL"
                : state.channel
                  ? `CONTEXT FOR @${state.channel}`
                  : "YOUR COMMUNITY’S CURRENT BRIEF"}
            </div>
            <h1>
              {raid ? (
                <>
                  You’re right on time,
                  <br />
                  <em>{raid.from}&apos;s community.</em>
                </>
              ) : (
                <>
                  Just arrived?
                  <br />
                  <em>You’re part of this.</em>
                </>
              )}
            </h1>
            <p>
              {raid
                ? "A new community. The same adventure. Here’s where we are, and where you come in."
                : "A little context. A shared goal. Your next move."}
            </p>
          </div>
          {(!fresh || error) && (
            <div className="viewer-connection" role="status">
              <RefreshCw size={14} /> Waiting for a fresh brief. The last
              context is shown; participation commands are paused.
            </div>
          )}
          <div className="viewer-grid">
            <div>
              <BriefCard
                state={state}
                paused={!fresh || connectionPaused}
                pauseReason={pauseReason}
              />
              {active && (
                <div className="viewer-instructions">
                  <span className="step-circle">1</span>
                  <p>Read the brief.</p>
                  <span className="step-circle">2</span>
                  <p>Open Twitch chat.</p>
                  <span className="step-circle">3</span>
                  <p>Make your move.</p>
                </div>
              )}
            </div>
            <aside className="viewer-side">
              {demo &&
              /axolotl|bubbles/i.test(
                state.brief.title + " " + state.brief.context,
              ) ? (
                <MissionMap small />
              ) : (
                <div className="viewer-signal">
                  <div className="signal-orbit">
                    <span />
                    <span />
                    <span />
                    <i>
                      <Users size={35} />
                    </i>
                  </div>
                  <span className="eyebrow">
                    A SHARED MOMENT STARTS WITH YOU.
                  </span>
                </div>
              )}
              <section className="viewer-next">
                <span className="eyebrow">
                  YOU DON’T NEED TO CATCH UP ON EVERYTHING.
                </span>
                <h2>Just take the next step.</h2>
                <p>
                  {active
                    ? "Your choice counts once. You can change it. No follow, subscription, or explanation required."
                    : connectionPaused
                      ? "The current brief is ready. Chat participation will open when the creator connects Twitch."
                      : "The next chapter is being prepared. You can still say hello and be part of the conversation."}
                </p>
                {!demo && state.channel && (
                  <a
                    className="btn btn-twitch"
                    href={`https://www.twitch.tv/${encodeURIComponent(state.channel)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <TwitchGlyph /> Open Twitch chat <ArrowUpRight size={15} />
                  </a>
                )}
                {demo && (
                  <a className="btn btn-primary" href="/demo">
                    Try the chat simulator <ArrowRight size={15} />
                  </a>
                )}
              </section>
              {state.brief.version > 0 && (
                <section className="viewer-votes">
                  <div>
                    <span className="eyebrow">
                      {active
                        ? "THE COMMUNITY’S NEXT MOVE"
                        : "THIS CHAPTER’S DECISION"}
                    </span>
                    <span>
                      {metrics!.unique} {demo ? "simulated " : ""}contribution
                      {metrics!.unique !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {state.brief.choices.map((choice, i) => {
                    const count = metrics!.counts[choice.id] || 0,
                      pct = metrics!.votes.length
                        ? Math.round((count / metrics!.votes.length) * 100)
                        : 0;
                    return (
                      <div className="viewer-vote" key={choice.id}>
                        <div>
                          <span>
                            {choice.id} <b>{choice.label}</b>
                          </span>
                          <strong>{pct}%</strong>
                        </div>
                        <div className="result-track">
                          <div
                            className={
                              i % 2 ? "result-fill violet" : "result-fill"
                            }
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        {active && (
                          <CopyButton
                            value={`!join ${choice.id}`}
                            label="Copy chat command"
                          />
                        )}
                      </div>
                    );
                  })}
                </section>
              )}
            </aside>
          </div>
          <section className="viewer-community-note">
            <ShieldCheck size={20} />
            <div>
              <strong>Your community’s context. Your streamer’s call.</strong>
              <p>
                {active ? (
                  <>
                    This brief is published by the creator. Have something
                    useful to add? Type <code>!pitch Your update</code> in
                    Twitch chat for review.
                  </>
                ) : fresh && !connectionPaused ? (
                  "This chapter has ended. Wait for the creator to publish the next invitation."
                ) : (
                  pauseReason ||
                  "Live context could not be confirmed. Participation commands will reappear when a fresh brief arrives."
                )}
              </p>
            </div>
          </section>
        </>
      )}
      <footer className="viewer-footer">
        <Brand />
        <span>Give every viewer a way in.</span>
        <Link href="/">
          Create your community’s Rallypoint <ArrowUpRight size={13} />
        </Link>
      </footer>
    </main>
  );
}
