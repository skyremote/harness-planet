// Shared by server.ts (caller) and host.ts (implementation). Validated at both ends.
import { defineRpcContract } from "@get-bb/plugin-sdk";
import { z } from "zod";

export const serverState = z.object({
  running: z.boolean(),
  url: z.string(),
  pid: z.number().nullable(),
  message: z.string(),
});
export type ServerState = z.infer<typeof serverState>;

const target = z.object({ repoPath: z.string().min(1), port: z.number().int().min(1).max(65535) }).strict();

export const hostContract = defineRpcContract({
  status: { input: target, output: serverState },
  start: { input: target, output: serverState },
  stop: { input: target, output: serverState },
});
