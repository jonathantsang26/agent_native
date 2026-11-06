/**
 * The incident map's vocabulary, shared by the map UI (which publishes its
 * state and applies commands) and the agent's actions (which read the state
 * and write commands).
 */

export const MAP_LAYER_IDS = [
  "terrain",
  "burnScar",
  "fireSpread",
  "perimeters",
  "ignition",
  "spine",
  "wind",
  "structures",
  "roads",
  "labels",
  "debrisFlow",
  "forecast",
  "liveHits",
] as const;
export type MapLayerId = (typeof MAP_LAYER_IDS)[number];

export const MAP_TABS = ["incident", "drones", "risk"] as const;
export type MapTab = (typeof MAP_TABS)[number];

export const RAIL_TABS = ["Layers", "Analysis", "Evidence", "Swarm"] as const;
export type RailTab = (typeof RAIL_TABS)[number];

export type MapCamera = {
  lon: number;
  lat: number;
  zoom: number;
  pitch: number;
  bearing: number;
};

/** What the map publishes under the `incident-map` app-state key. */
export type MapState = {
  fire: string;
  fireName: string;
  timezone: string;
  /** Replay time, UTC ISO. */
  t: string;
  tLocal: string;
  window: { start: string; end: string };
  playing: boolean;
  tab: MapTab;
  railTab: RailTab;
  viewMode: "2d" | "3d";
  visibleLayers: MapLayerId[];
  camera: MapCamera | null;
  highlight: { lon: number; lat: number; label?: string } | null;
  /** The spot the user last clicked on the map ("here", "this spot"). */
  picked: { lon: number; lat: number } | null;
  selectedStructure: number | null;
  risk: { model: string; i15: number; segment: number | null };
};

/** One command the agent writes under `map-command`; every field is optional and applied together. */
export type MapCommand = {
  flyTo?: { lon: number; lat: number; zoom?: number };
  time?: string;
  showLayers?: MapLayerId[];
  hideLayers?: MapLayerId[];
  tab?: MapTab;
  railTab?: RailTab;
  viewMode?: "2d" | "3d";
  highlight?: { lon: number; lat: number; label?: string } | null;
  playing?: boolean;
  _writeId?: string;
};
