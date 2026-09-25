# Harness Planet for bb

A bb plugin that adds a **Harness Planet** page to bb's sidebar, with an On/Off button. On builds and starts the Harness Planet server from the checkout (127.0.0.1:5274); Off stops it. While it is on, the planet is shown inside the page.

- Install: `bb plugin install ./bb-plugin-harness-planet` (after `npm install` in both the repo root and this folder).
- CLI: `bb harness-planet on | off | status [--json]`.
- Settings: `bb plugin config harness-planet` — `repoPath` (default `~/Documents/GitHub/harness-planet`) and `port`.

`host.ts` owns the process (detached `npm start`, pid file and log in the plugin's data directory); `server.ts` wires RPC, CLI and settings; `app.tsx` is the page.
