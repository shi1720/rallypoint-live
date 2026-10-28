"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createDemoState, transition } from "@/lib/rally/engine";
import type {
  Action,
  Connection,
  RallyState,
  RoomResponse,
} from "@/lib/rally/types";
export const DEMO_KEY = "rallypoint.rehearsal.v1";
export function readDemo() {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        parsed?.brief &&
        Array.isArray(parsed.contributions) &&
        Array.isArray(parsed.activity) &&
        Array.isArray(parsed.raids) &&
        Array.isArray(parsed.proposals) &&
        typeof parsed.revision === "number"
      )
        return parsed as RallyState;
    }
  } catch {
    /* corrupt browser storage is safely reset */
  }
  return createDemoState();
}
export function writeDemo(state: RallyState) {
  localStorage.setItem(DEMO_KEY, JSON.stringify(state));
  window.dispatchEvent(new Event("rallypoint-demo"));
}
const disconnected: Connection = { configured: false, connected: false };
export function useRally(demo: boolean) {
  const [state, setState] = useState<RallyState | null>(null),
    [connection, setConnection] = useState<Connection>(disconnected),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [authRequired, setAuthRequired] = useState(false),
    [publicUrl, setPublicUrl] = useState(""),
    [overlayUrl, setOverlayUrl] = useState("");
  const stateRef = useRef<RallyState | null>(null),
    connectionCheck = useRef<Connection | null>(null);
  stateRef.current = state;
  const receive = useCallback((data: RoomResponse) => {
    setState((old) =>
      old && old.revision > data.state.revision ? old : data.state,
    );
    if (
      connectionCheck.current &&
      connectionCheck.current.broadcasterId === data.connection.broadcasterId
    )
      setConnection({ ...data.connection, ...connectionCheck.current });
    else {
      connectionCheck.current = null;
      setConnection(data.connection);
    }
    setPublicUrl(data.publicUrl);
    setOverlayUrl(data.overlayUrl);
  }, []);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/room", { cache: "no-store" });
      if (response.status === 401) {
        setAuthRequired(true);
        return;
      }
      const data = (await response.json()) as RoomResponse & {
        error?: string;
        reply?: string;
      };
      if (!response.ok)
        throw new Error(data.error || "Could not load your desk.");
      receive(data);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your desk.");
    } finally {
      setLoading(false);
    }
  }, [receive]);
  useEffect(() => {
    if (demo) {
      const sync = () => setState(readDemo());
      const initial = readDemo();
      try {
        writeDemo(initial);
      } catch {
        setError(
          "Browser storage is unavailable. Your rehearsal will last for this tab.",
        );
      }
      setState(initial);
      setPublicUrl(`${location.origin}/watch/demo`);
      setOverlayUrl(`${location.origin}/overlay/demo`);
      setLoading(false);
      window.addEventListener("storage", sync);
      window.addEventListener("rallypoint-demo", sync);
      return () => {
        window.removeEventListener("storage", sync);
        window.removeEventListener("rallypoint-demo", sync);
      };
    }
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [demo, refresh]);
  useEffect(() => {
    if (demo || !connection.broadcasterId) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const verify = async () => {
      try {
        const response = await fetch("/api/twitch/status", {
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        });
        const data = (await response.json()) as Connection & { error?: string };
        if (!response.ok)
          throw new Error(
            data.error || "Twitch verification could not be refreshed.",
          );
        if (!stopped) {
          connectionCheck.current = data;
          setConnection(data);
        }
      } catch {
        if (!stopped)
          setConnection((previous) => {
            const unverified = {
              ...previous,
              connected: false,
              error:
                "Twitch verification could not be refreshed. Retry in Channel setup.",
              webhookStatus: "unverified",
            };
            connectionCheck.current = unverified;
            return unverified;
          });
      } finally {
        if (!stopped) timer = setTimeout(verify, 15000);
      }
    };
    verify();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [demo, connection.broadcasterId]);
  const dispatch = useCallback(
    async (action: Action): Promise<string | undefined> => {
      setBusy(true);
      setError("");
      try {
        if (demo) {
          const current = stateRef.current || readDemo();
          const result = transition(current, action);
          setState(result.state);
          try {
            writeDemo(result.state);
          } catch {
            /* tab remains fully functional without persistence */
          }
          return result.reply;
        }
        const response = await fetch("/api/room", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action),
        });
        const data = (await response.json()) as RoomResponse & {
          error?: string;
          reply?: string;
        };
        if (!response.ok)
          throw new Error(data.error || "That change could not be saved.");
        receive(data);
        return data.reply;
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "That change could not be saved.";
        setError(message);
        throw new Error(message);
      } finally {
        setBusy(false);
      }
    },
    [demo, receive],
  );
  const reset = useCallback(() => {
    if (!demo) return;
    const fresh = createDemoState();
    setState(fresh);
    try {
      writeDemo(fresh);
    } catch {}
  }, [demo]);
  return {
    state,
    connection,
    loading,
    busy,
    error,
    authRequired,
    publicUrl,
    overlayUrl,
    dispatch,
    reset,
    refresh,
    setError,
  };
}
