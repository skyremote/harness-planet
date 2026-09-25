---
name: harness-planet
description: Turn the Harness Planet agent map on or off, or check whether it is running. Use when the user asks to start, stop, show or check Harness Planet.
---

# Harness Planet

Harness Planet shows every Claude Code, Codex, Cursor and bb thread on this machine as a bot on a 3D planet. It runs as a local server on 127.0.0.1 (port 5274 by default) from the harness-planet checkout.

- `bb harness-planet on` starts it (builds, then serves) and prints the URL.
- `bb harness-planet off` stops it.
- `bb harness-planet status [--json]` reports whether it is running.

The user can also use the Harness Planet page in bb's sidebar, which has the same On/Off button and shows the planet inline.

Settings (`bb plugin config harness-planet`): `repoPath` (the checkout, default `~/Documents/GitHub/harness-planet`) and `port`.
