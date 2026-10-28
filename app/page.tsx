import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ShieldCheck,
  Users,
  Terminal,
  Layers,
} from "lucide-react";
import { Brand, MissionMap, TwitchGlyph } from "@/components/rally/shared";
export default function Home() {
  return (
    <main className="landing">
      <nav className="landing-nav">
        <Brand />
        <div className="nav-links">
          <a href="#how-it-works">How it works</a>
          <a href="#creator-control">Built for live</a>
          <a href="/demo">Try rehearsal</a>
        </div>
        <a className="btn btn-quiet" href="/studio">
          Open your desk <ArrowUpRight size={16} />
        </a>
      </nav>
      <section className="landing-hero">
        <div className="hero-copy">
          <div className="eyebrow hero-eyebrow">
            <TwitchGlyph /> FOR THE MOMENT SOMEONE JOINS
          </div>
          <h1>
            Don’t just welcome
            <br />
            them. <em>Bring them in.</em>
          </h1>
          <p>
            Your stream is already a story. Give every new viewer the context,
            the stakes, and one clear way to be part of it.
          </p>
          <div className="hero-actions">
            <a href="/demo" className="btn btn-primary btn-large">
              Try rehearsal <ArrowRight size={18} />
            </a>
            <a href="/studio" className="btn btn-quiet btn-large">
              Set up your channel <ArrowUpRight size={17} />
            </a>
          </div>
          <div className="hero-footnote">
            <span>
              <Check size={13} /> Try it before connecting Twitch
            </span>
            <span>
              <Check size={13} /> Creator controls included
            </span>
          </div>
        </div>
        <div className="hero-index" aria-hidden="true">
          <span>001</span>
          <div />
          <p>
            THE NEXT GREAT
            <br />
            COMMUNITY MEMBER
            <br />
            JUST ARRIVED.
          </p>
        </div>
      </section>
      <section className="hero-stage" aria-label="Example Rallypoint mission">
        <div className="stage-title">
          <div>
            <span className="sample-dot" />
            <strong>THE PARTICIPATION DESK</strong>
            <span className="stage-channel">
              <TwitchGlyph /> your next stream
            </span>
          </div>
          <span className="badge badge-outline">ILLUSTRATIVE MISSION</span>
        </div>
        <div className="stage-body">
          <div className="stage-mission">
            <div className="eyebrow">CHAPTER 04 / THE RESCUE</div>
            <h2>
              Operation:
              <br />
              <span>save the axolotl.</span>
            </h2>
            <p>
              Chat named him Bubbles. Now he’s stranded. Two routes, one rescue.
              Everyone gets a say.
            </p>
            <div className="sample-vote">
              <code>!join A</code>
              <span>Build a bridge</span>
              <ArrowUpRight size={16} />
            </div>
            <div className="sample-vote">
              <code>!join B</code>
              <span>Dig a tunnel</span>
              <ArrowUpRight size={16} />
            </div>
            <div className="stage-bottom">
              <ShieldCheck size={15} />
              <span>Streamer-approved. Ready for arrivals.</span>
            </div>
          </div>
          <div className="stage-map">
            <MissionMap />
            <div className="map-caption">
              <span>CONTEXT → AGENCY → BELONGING</span>
              <span>A LITTLE CONTEXT. A REAL ROLE.</span>
            </div>
          </div>
        </div>
      </section>
      <section id="how-it-works" className="how-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">
              FROM “WHAT DID I MISS?” TO “I’M IN.”
            </span>
            <h2>
              A welcome with
              <br />
              something to do.
            </h2>
          </div>
          <p>
            A recap explains the past. A Rallypoint brief opens the next chapter
            to everyone.
          </p>
        </div>
        <div className="feature-grid">
          <article>
            <span className="feature-number">01 / SET THE SCENE</span>
            <div className="feature-icon">
              <Layers />
            </div>
            <h3>One living brief.</h3>
            <p>
              The goal, the stakes, and the exact chat action. Publish once;
              your viewer page, chat response, and OBS overlay stay in step.
            </p>
          </article>
          <article>
            <span className="feature-number">02 / MAKE ROOM</span>
            <div className="feature-icon">
              <Users />
            </div>
            <h3>Raids get a way in.</h3>
            <p>
              When a community arrives, the current brief becomes their welcome.
              No awkward scrollback. No need to ask the regulars.
            </p>
          </article>
          <article>
            <span className="feature-number">03 / KEEP THE REINS</span>
            <div className="feature-icon">
              <ShieldCheck />
            </div>
            <h3>
              Community-powered.
              <br />
              Creator-approved.
            </h3>
            <p>
              Chat pitches updates. You review them. Unapproved suggestions
              never reach the brief, and expired actions stop everywhere.
            </p>
          </article>
        </div>
      </section>
      <section id="creator-control" className="control-section">
        <div className="control-copy">
          <span className="eyebrow">LOW FRICTION. LOW OVERHEAD.</span>
          <h2>
            Live moves fast.
            <br />
            Your tools should keep up.
          </h2>
          <p>
            Made for shared challenges, collaborative builds, and communities
            with a story in progress. Your current context stays in your
            control. No audio recording or per-message AI costs.
          </p>
          <a href="/demo" className="text-link">
            Run a two-minute rehearsal <ArrowRight size={17} />
          </a>
        </div>
        <div className="terminal-card">
          <div className="terminal-top">
            <Terminal size={16} />
            <span>THE WHOLE LEARNING CURVE</span>
            <i />
          </div>
          <div>
            <code>!catchup</code>
            <p>Get the approved brief.</p>
          </div>
          <div>
            <code>!join A</code>
            <p>Take part in the current decision.</p>
          </div>
          <div>
            <code>!pitch Your update here</code>
            <p>Offer context for the streamer to review.</p>
          </div>
          <footer>
            <Check size={13} /> One decision. One vote per viewer. Change your
            mind anytime.
          </footer>
        </div>
      </section>
      <section className="landing-cta">
        <div>
          <span className="eyebrow">EVERY REGULAR WAS NEW ONCE.</span>
          <h2>Give them a starting point.</h2>
        </div>
        <a href="/demo" className="btn btn-primary btn-large">
          Enter Rallypoint <ArrowRight size={18} />
        </a>
      </section>
      <footer className="landing-footer">
        <Brand />
        <p>A little context. A real role.</p>
        <div>
          <a href="/studio">Creator desk</a>
          <a href="/demo">
            Interactive rehearsal <ArrowUpRight size={12} />
          </a>
        </div>
      </footer>
    </main>
  );
}
