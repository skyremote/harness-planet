// The Harness Planet page in bb's sidebar: an On/Off button, and the planet itself underneath
// while it is on.
import { useCallback, useEffect, useState } from "react";
import { definePluginApp, useRealtime, useRpc } from "@get-bb/plugin-sdk/app";
import type { rpcContract } from "./server";
import type { ServerState } from "./contract";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

function HarnessPlanetPage() {
  const rpc = useRpc<typeof rpcContract>();
  const [state, setState] = useState<ServerState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    rpc.call("status").then(
      (s) => { setState(s); setError(null); },
      (e) => setError(e instanceof Error ? e.message : String(e)),
    );
  }, [rpc]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, [refresh]);
  useRealtime("state-changed", refresh);

  const toggle = async () => {
    if (busy || !state) return;
    setBusy(true);
    try {
      setState(await rpc.call(state.running ? "stop" : "start"));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const running = state?.running === true;
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
        <span
          className={cn("size-2.5 rounded-full", running ? "bg-green-500" : "bg-muted-foreground/40")}
          aria-hidden
        />
        <span className="text-sm font-medium">
          {state === null ? "Checking…" : running ? "On" : "Off"}
        </span>
        {running ? (
          <span className="truncate font-mono text-xs text-muted-foreground">{state?.url}</span>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          {running ? (
            <Button variant="ghost" size="sm" asChild>
              <a href={state?.url} target="_blank" rel="noreferrer">
                <Icon name="ExternalLink" className="size-4" />
                Open in browser
              </a>
            </Button>
          ) : null}
          <Button size="sm" variant={running ? "outline" : "default"} disabled={busy || state === null} onClick={toggle}>
            <Icon name={running ? "Square" : "Play"} className="size-4" />
            {busy ? (running ? "Stopping…" : "Starting…") : running ? "Turn off" : "Turn on"}
          </Button>
        </div>
      </div>
      {error ? (
        <p role="alert" className="px-4 py-2 text-sm text-destructive">{error}</p>
      ) : state?.message && !running ? (
        <p className="px-4 py-2 text-sm text-muted-foreground">{state.message}</p>
      ) : null}
      {running && state ? (
        <iframe title="Harness Planet" src={state.url} className="min-h-0 w-full flex-1 border-0" />
      ) : (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
          Harness Planet is off. Turn it on to see every Claude Code, Codex, Cursor and bb thread as a bot on the planet.
        </div>
      )}
    </div>
  );
}

export default definePluginApp((app) => {
  app.slots.navPanel({
    id: "planet",
    title: "Harness Planet",
    icon: "Globe",
    path: "planet",
    component: HarnessPlanetPage,
  });
});
