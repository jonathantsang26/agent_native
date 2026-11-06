import { useSemanticNavigationState } from "@agent-native/core/client/navigation";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";

import { TAB_ID } from "@/lib/tab-id";
import { MAP_LAYER_IDS, type MapCommand, type MapState } from "@shared/map";

import type { FireData } from "../data/fire";
import { formatDateTime, zoneLabel } from "../lib/format";
import { useTime } from "../state/time";
import { useUi } from "../state/ui";

/** App-state keys; the server side reads and writes the same ones (server/lib/fire/run.ts). */
const STATE_KEYS = [`incident-map:${TAB_ID}`, "incident-map"];
const COMMAND_KEYS = [`map-command:${TAB_ID}`, "map-command"];

const MINUTE = 60_000;
const round = (v: number, places: number) => Math.round(v * 10 ** places) / 10 ** places;

/** Applies one agent command to the map stores; every field is optional. */
export function applyMapCommand(cmd: MapCommand) {
  const ui = useUi.getState();
  const time = useTime.getState();
  if (cmd.tab) ui.setTab(cmd.tab);
  if (cmd.railTab) {
    ui.setTab("incident");
    ui.setRailTab(cmd.railTab);
  }
  if (cmd.viewMode) ui.setViewMode(cmd.viewMode);
  for (const id of cmd.showLayers ?? []) ui.setLayer(id, { visible: true });
  for (const id of cmd.hideLayers ?? []) ui.setLayer(id, { visible: false });
  if (cmd.time) {
    const ms = Date.parse(cmd.time);
    if (Number.isFinite(ms)) time.setTime(ms);
  }
  if (cmd.playing !== undefined && cmd.playing !== useTime.getState().playing) {
    useTime.getState().toggle();
  }
  if (cmd.flyTo) ui.requestFlyTo(cmd.flyTo.lon, cmd.flyTo.lat, cmd.flyTo.zoom);
  if (cmd.highlight !== undefined) ui.setHighlight(cmd.highlight);
}

/**
 * Publishes what the map shows to application state (the agent reads it through
 * view-screen and <current-screen>) and applies the commands the agent's
 * update-map action writes. Mounted once, inside the client-only map tree.
 */
export function AgentMapBridge({ fire }: { fire: FireData }) {
  const ui = useUi(
    useShallow((s) => ({
      tab: s.tab,
      railTab: s.railTab,
      viewMode: s.viewMode,
      layers: s.layers,
      camera: s.camera,
      highlight: s.highlight,
      pin: s.pin,
      selectedStructure: s.selectedStructure,
      risk: s.risk,
    })),
  );
  const playing = useTime((s) => s.playing);
  // While playing, publish every 15 fire-minutes instead of every frame.
  const t = useTime((s) => {
    const step = s.playing ? 15 * MINUTE : MINUTE;
    return Math.round(s.t / step) * step;
  });
  const start = useTime((s) => s.start);
  const end = useTime((s) => s.end);

  const state = useMemo<MapState>(() => {
    const tz = fire.aoi.timezone;
    const c = ui.camera;
    return {
      fire: fire.id,
      fireName: fire.aoi.name,
      timezone: tz,
      t: new Date(t).toISOString(),
      tLocal: `${formatDateTime(t, tz)} ${zoneLabel(t, tz)}`,
      window: { start: new Date(start).toISOString(), end: new Date(end).toISOString() },
      playing,
      tab: ui.tab,
      railTab: ui.railTab,
      viewMode: ui.viewMode,
      visibleLayers: MAP_LAYER_IDS.filter((id) => ui.layers[id]?.visible && ui.layers[id]?.ready),
      camera: c
        ? {
            lon: round(c.lon, 4),
            lat: round(c.lat, 4),
            zoom: round(c.zoom, 1),
            pitch: Math.round(c.pitch),
            bearing: Math.round(c.bearing),
          }
        : null,
      highlight: ui.highlight,
      picked: ui.pin ? { lon: round(ui.pin.lon, 5), lat: round(ui.pin.lat, 5) } : null,
      selectedStructure: ui.selectedStructure,
      risk: ui.risk,
    };
  }, [fire, ui, playing, t, start, end]);

  useSemanticNavigationState<MapState, MapCommand>({
    state,
    navigationKeys: STATE_KEYS,
    commandKeys: COMMAND_KEYS,
    browserTabId: TAB_ID,
    requestSource: TAB_ID,
    // An "app-state" query key lets useDbSync refetch as soon as the agent
    // writes a command; the interval only covers writers whose change events
    // don't reach this tab (another process, such as the CLI).
    commandQueryKey: ["app-state", "map-command", TAB_ID],
    commandRefetchInterval: 5_000,
    writeDebounceMs: 400,
    getCommandDedupKey: (cmd) => cmd._writeId ?? JSON.stringify(cmd),
    onCommand: applyMapCommand,
  });

  return null;
}
