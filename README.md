# Sentinel Ember

**A wildfire incident map you can talk to.** Sentinel Ember reconstructs the January 2025 Eaton and Palisades fires (Los Angeles County) on 3D terrain, and puts an agent beside the map that reads the same fire data and drives the same map you see.

Ask "when did the fire reach Lake Avenue?" and the agent looks the street up, walks it through the fire's arrival raster, answers with times it can cite, and then flies the map there, sets the replay clock to that moment and pins the spot.

Built on [Agent-Native](https://www.agent-native.com/docs/), Builder.io's framework for apps where the agent and the UI share one set of actions and one application state.

## What the agent can do

| You ask | The agent | Framework piece |
|---|---|---|
| "How big was it at 4 AM, and what was the wind doing?" | Reads the replay time from your screen, calls `get-fire-state` and `get-weather`, cites `[source ids]` | Actions as agent tools, `<current-screen>` context |
| "Show me where the damage was worst near Altadena" | `find-place` → `count-structures-near`, then `update-map` turns on structures, flies there and pins the point | Shared application state (`incident-map` / `map-command`) |
| "Chart the fire's growth" | `fire-growth-chart` renders a chart inside the chat | Native data widgets in chat |
| "Write a brief for 4 AM in Altadena" | Gathers the figures, saves a tagged report with `save-brief`, opens the Briefs panel and flies there | SQL via Drizzle, live sync, shared actions |
| *Click any spot on the map* | "Ask the agent about this spot" sends the point and the replay time to the agent | `sendToAgentChat`, `picked` in the map state |
| "Switch to the Palisades fire" | `navigate {view: "incident", fireId: "palisades"}` | Navigation state |
| Anything with a number in it | A response guard checks every figure against this turn's action results and sends ungrounded answers back | `finalResponseGuard` |
| Claude Desktop, Cursor, ChatGPT | The ten fire-data actions are listed for external agents on the OAuth-protected MCP server at `/mcp` (connect with `npx @agent-native/core@latest connect <app-url>`; not yet tried from a host) | MCP server, `connectorCatalog` |

The map itself is the original UI: deck.gl terrain, the replay timeline, the right rail (layers, analysis, evidence, swarm replay), the Drones tab with an in-browser fire detector, and the Risk tab for post-fire debris flows.

## How it fits together

```
 Browser                                   Server (Nitro)
 ┌──────────────────────────────┐          ┌───────────────────────────────────┐
 │ /fires/:fireId (client only) │  writes  │ application_state                 │
 │  deck.gl map, rail, timeline ├─────────►│  incident-map:<tab>  what you see │
 │  agent/bridge.tsx            │◄─────────┤  map-command:<tab>   what to show │
 │                              │  applies │                                   │
 │ AgentSidebar (toolkit)       │─────────►│ agent loop  ── tools ──► actions/ │
 └──────────────────────────────┘          │   finalResponseGuard     │        │
                                           │                server/lib/fire/   │
                                           │                (bundled fire data)│
                                           └───────────────────────────────────┘
```

- `actions/` — one file per capability. The same action is an agent tool, a typed UI call, an HTTP endpoint (`/_agent-native/actions/<name>`), an MCP tool and a CLI command (`pnpm action <name>`).
- `app/sentinel/agent/bridge.tsx` publishes the map's state (fire, replay time, tab, visible layers, camera, selection) and applies the agent's commands.
- `server/lib/fire/` holds the fire tools. They read the precomputed layers, bundled into the server by `pnpm fire-data`, so they run on serverless hosts too.
- `server/lib/fire/guard.ts` holds answers to figures the actions returned, and keeps cause speculation and street addresses out.
- `server/db/` and `server/plugins/db.ts` hold the briefs table (Drizzle, additive migrations); the Briefs panel reads it with `useActionQuery` and refreshes when the agent writes.
- `server/routes/api/sam.post.ts` outlines fire in live drone frames with SAM 3.1, under a daily spend cap.
- `AGENTS.md` and `.agents/skills/{fire-analyst,incident-map}` are the agent's instructions.

## Live, cached and simulated

| Part | Status |
|---|---|
| Agent answers and map control | **Live.** Needs an LLM key (`ANTHROPIC_API_KEY`, or connect Builder.io in the sidebar). |
| Fire detector (Drones → Live) | **Live**, in the browser (fine-tuned YOLOv8, ONNX on WebAssembly). No key needed. |
| SAM 3.1 outlines (Drones → Live) | **Live**, needs `MODEL_API_KEY`; spend capped per day. |
| Bundled drone clips | **Cached.** Two public-domain BLM wildfire clips with precomputed boxes and masks. They are not Eaton footage. |
| +1 h spread forecast, drone swarm | **Cached / simulated.** Replays of earlier model runs and a physics simulation; no drones flew these fires. |
| Fire reconstruction (arrival times, ignition estimate, damage, debris flows) | **Precomputed** from public records and labelled MODELED where it is modeled. |

The map labels each layer REAL, MODELED, FORECAST or SIM, and the Evidence panel lists every source.

## Run it locally

Needs Node 22.22+ and pnpm 10.

```bash
corepack enable
pnpm install
cp .env.example .env    # set AUTH_DISABLED=true for local use, and ANTHROPIC_API_KEY
pnpm dev                # http://localhost:8080 → /fires/eaton
```

Local dev runs on PGlite; nothing else to set up. Without an LLM key the map and every action still work, and the sidebar offers to connect one.

Checks: `pnpm typecheck`, `pnpm test` (207 tests: fire tools, response guard, eval scorer, SAM route, map projection), `pnpm agent-native:doctor`.

Evals: `evals/fire-analyst.eval.ts` asks the live agent 33 questions whose answers were computed straight from the fire data (street arrival times, burned acres, spread rate, gusts, humidity, damage counts, the withheld start time, an odds ratio). Each must match the truth (±30 min, ±5%), call the right action and tag its figures. The scorer reproduces the verdicts recorded with the questions. `evals/production-context.ts` runs them through the same prompt, tools and guard as the chat:

```bash
DATABASE_URL=pglite:memory pnpm eval --owner-email you@example.com --org-id local
```

Drive the map from a terminal the way the agent does:

```bash
AGENT_USER_EMAIL=dev@local.test pnpm action update-map '{"flyTo":{"lon":-118.1317,"lat":34.1899,"zoom":14.5},"time":"2025-01-08T12:00:00Z","showLayers":["structures"]}'
curl "http://localhost:8080/_agent-native/actions/get-street-timeline?name=Lake%20Ave"
```

## Deploy

The framework keeps chat threads and application state in Postgres, so a deployment needs a hosted database (Neon's free tier works):

```bash
DATABASE_URL=… BETTER_AUTH_SECRET=… ANTHROPIC_API_KEY=… pnpm migrate:production
NITRO_PRESET=vercel pnpm build    # or netlify, node
```

Set the same variables on the host, plus `MODEL_API_KEY` and an Upstash store (`KV_REST_API_URL`/`KV_REST_API_TOKEN`) for SAM outlines. The map's static data is about 100 MB under `public/data`; deploy from Git (or a host without a CLI upload cap) rather than a CLI upload on a free tier.

## Data

Perimeters from NIFC and CAL FIRE; hourly weather and wind from NOAA HRRR via the Open-Meteo archive (CC BY 4.0); damage inspections from CAL FIRE DINS; debris-flow hazard assessments from USGS; provisional burn severity from NASA JPL AVIRIS-3; terrain from AWS Terrain Tiles (USGS 3DEP and others); roads and places from OpenStreetMap (ODbL); land cover from ESA WorldCover; fire danger from gridMET; station weather from the Iowa Environmental Mesonet; drone clips from BLM via Wikimedia Commons (public domain). Each layer's source and retrieval date are in the app's Evidence panel. Street addresses are never shown. The layout is inspired by Dilum Sanjaya's "FireTrace" wildfire-analysis concept; its name and logo are not used.
