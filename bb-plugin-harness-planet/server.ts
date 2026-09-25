// Harness Planet for bb: an On/Off switch for the Harness Planet server and a sidebar page
// that shows it. The process itself is owned by host.ts (the machine side); this entry wires
// the page's RPC, the `bb harness-planet` CLI, and settings to it.
import os from "node:os";
import path from "node:path";
import { defineRpcContract, type BbPluginApi } from "@get-bb/plugin-sdk";
import { z } from "zod";
import { hostContract, serverState, type ServerState } from "./contract";

export const rpcContract = defineRpcContract({
  status: { input: z.null(), output: serverState },
  start: { input: z.null(), output: serverState },
  stop: { input: z.null(), output: serverState },
});

const STATE_CHANGED = "state-changed";

export default async function plugin(bb: BbPluginApi) {
  const settings = bb.settings.define({
    repoPath: {
      type: "string",
      label: "Harness Planet checkout",
      description: "Folder containing the harness-planet repo (npm install already run).",
      default: path.join(os.homedir(), "Documents", "GitHub", "harness-planet"),
    },
    port: {
      type: "number",
      label: "Port",
      default: 5274,
    },
  });
  const { repoPath, port } = await settings.get();
  const target = { repoPath: String(repoPath), port: Number(port) || 5274 };

  const host = bb.hosts.experimental_client({ contract: hostContract });

  async function hostId(): Promise<string> {
    const id = (await bb.sdk.system.config()).primaryHostId;
    if (!id) throw new Error("bb has no local machine registered to run Harness Planet on");
    return id;
  }

  async function run(method: "status" | "start" | "stop"): Promise<ServerState> {
    const result = await host.call(method, target, { hostId: await hostId() });
    if (method !== "status") bb.realtime.publish(STATE_CHANGED, { running: result.running });
    return result;
  }

  bb.rpc.register(rpcContract, {
    status: () => run("status"),
    start: () => run("start"),
    stop: () => run("stop"),
  });

  const usage = "Usage: bb harness-planet on|off|status [--json]";
  bb.cli.register({
    name: "harness-planet",
    summary: "Turn the Harness Planet agent map on or off",
    commands: [
      { name: "on", summary: "Start Harness Planet", usage: "bb harness-planet on [--json]" },
      { name: "off", summary: "Stop Harness Planet", usage: "bb harness-planet off [--json]" },
      { name: "status", summary: "Is it running, and where", usage: "bb harness-planet status [--json]" },
    ],
    async run(argv) {
      const json = argv.includes("--json");
      const [command] = argv.filter((a) => a !== "--json");
      const method = command === "on" ? "start" : command === "off" ? "stop" : command === "status" ? "status" : null;
      if (!method) return { exitCode: command ? 1 : 0, stdout: usage };
      const s = await run(method);
      const text = `${s.running ? "On" : "Off"}${s.running ? `  ${s.url}` : ""}${s.message ? `  (${s.message})` : ""}`;
      return { exitCode: 0, stdout: json ? JSON.stringify(s) : text };
    },
  });
}
