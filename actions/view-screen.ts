import { defineAction } from "@agent-native/core/action";
import { readAppStateForCurrentTab } from "@agent-native/core/application-state";
import { z } from "zod";

import { isFireId } from "../shared/fires.js";
import type { MapState } from "../shared/map.js";
import { readMapState } from "../server/lib/fire/run.js";
import { getFireStore } from "../server/lib/fire/store.js";
import { runFireTool } from "../server/lib/fire/tools.js";

/** Fire size and weather at the replay time, so "what am I looking at" needs no extra call. */
async function atReplayTime(map: MapState) {
  if (!isFireId(map.fire)) return null;
  const store = await getFireStore(map.fire);
  const read = (name: string) => {
    try {
      return runFireTool(store, name, { t: map.t });
    } catch {
      return null;
    }
  };
  const state = read("fire_state_at");
  const weather = read("weather_at");
  return {
    fire_state: state?.result ?? null,
    weather: weather?.result ?? null,
    sources: [...(state?.sources ?? []), ...(weather?.sources ?? [])],
  };
}

export default defineAction({
  description:
    "Read what the user is looking at: the route, and on the incident map the fire, replay time, tab, visible layers, camera and selection, plus fire size and weather at that time. Basic navigation is already in <current-screen>; call this for a fresh read.",
  schema: z.object({}),
  http: false,
  readOnly: true,
  run: async () => {
    const navigation = await readAppStateForCurrentTab("navigation", {
      fallbackToGlobal: true,
    });
    const map = (await readMapState()) as MapState | null;

    const screen: Record<string, unknown> = {};
    if (navigation) screen.navigation = navigation;
    // A tab that left the map keeps its last map state, so trust it only while
    // navigation says the map is open (or when there is no tab to ask, e.g. MCP).
    if (map && (!navigation || navigation.view === "incident")) {
      screen.map = map;
      screen.at_replay_time = await atReplayTime(map);
    }
    if (Object.keys(screen).length === 0) {
      return "No application state found. Is the app open in a browser?";
    }
    return screen;
  },
});
