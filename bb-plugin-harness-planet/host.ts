// Full-trust side (runs on the machine, inside bb's daemon worker). Owns the Harness Planet
// server process: `npm start` (build, then serve on 127.0.0.1) in the repo, detached, so it
// keeps running while the bb worker idles out. On/off state is simply "is the port answering".
import { spawn, execFile } from "node:child_process";
import { existsSync, openSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { experimental_defineHostEntry } from "@get-bb/plugin-sdk/host";
import { hostContract, type ServerState } from "./contract.js";

const urlOf = (port: number) => `http://127.0.0.1:${port}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function answering(port: number): Promise<boolean> {
  try {
    const res = await fetch(urlOf(port) + "/", { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

function listenerPids(port: number): Promise<number[]> {
  return new Promise((resolve) => {
    execFile("lsof", ["-tiTCP:" + port, "-sTCP:LISTEN"], (_err, out) =>
      resolve(String(out || "").split(/\s+/).map(Number).filter((n) => n > 0)),
    );
  });
}

const pidFile = (dataDir: string) => path.join(dataDir, "server.pid");
function readPid(dataDir: string): number | null {
  try {
    const n = Number(readFileSync(pidFile(dataDir), "utf8").trim());
    return n > 0 ? n : null;
  } catch {
    return null;
  }
}

async function state(port: number, dataDir: string, message = ""): Promise<ServerState> {
  const running = await answering(port);
  return { running, url: urlOf(port), pid: running ? readPid(dataDir) : null, message };
}

export default experimental_defineHostEntry({
  contract: hostContract,
  handlers: {
    status: async ({ port }, ctx) => state(port, ctx.experimental_paths.dataDir),

    start: async ({ repoPath, port }, ctx) => {
      const dataDir = ctx.experimental_paths.dataDir;
      if (await answering(port)) return state(port, dataDir, "Already running");
      if (!existsSync(path.join(repoPath, "package.json"))) {
        return { running: false, url: urlOf(port), pid: null, message: `No Harness Planet checkout at ${repoPath}` };
      }
      if (!existsSync(path.join(repoPath, "node_modules"))) {
        return { running: false, url: urlOf(port), pid: null, message: `Run npm install in ${repoPath} first` };
      }
      const log = openSync(path.join(dataDir, "server.log"), "a");
      const child = spawn("npm", ["start"], {
        cwd: repoPath,
        detached: true,
        stdio: ["ignore", log, log],
        env: { ...process.env, PORT: String(port) },
      });
      child.on("error", () => {});
      child.unref();
      if (child.pid) writeFileSync(pidFile(dataDir), String(child.pid));
      // Build is ~3s, then the server binds. Poll inside the 30s call budget.
      for (let i = 0; i < 40 && !ctx.signal.aborted; i++) {
        if (await answering(port)) return state(port, dataDir, "Started");
        await sleep(500);
      }
      return state(port, dataDir, "Still starting; see server.log in the plugin data directory");
    },

    stop: async ({ port }, ctx) => {
      const dataDir = ctx.experimental_paths.dataDir;
      const pid = readPid(dataDir);
      // The whole process group (npm and the node server under it), then anything still
      // holding the port — which also covers a server started by hand outside the button.
      if (pid) {
        try { process.kill(-pid, "SIGTERM"); } catch {}
      }
      for (const p of await listenerPids(port)) {
        try { process.kill(p, "SIGTERM"); } catch {}
      }
      rmSync(pidFile(dataDir), { force: true });
      for (let i = 0; i < 20; i++) {
        if (!(await answering(port))) break;
        await sleep(250);
      }
      return state(port, dataDir, "Stopped");
    },
  },
});
