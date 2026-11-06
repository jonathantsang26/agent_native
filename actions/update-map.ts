import { defineAction, fail } from "@agent-native/core/action";
import { writeAppStateForCurrentTab } from "@agent-native/core/application-state";
import { z } from "zod";

import { MAP_LAYER_IDS, MAP_TABS, RAIL_TABS, type MapCommand } from "../shared/map.js";
import { MAP_COMMAND_KEY } from "../server/lib/fire/run.js";

const point = {
  lon: z.number().min(-180).max(180).describe("Longitude, decimal degrees."),
  lat: z.number().min(-90).max(90).describe("Latitude, decimal degrees."),
};

export default defineAction({
  description:
    "Change what the incident map shows on the user's screen: fly the camera to a point, set the replay time, show or hide layers, switch tab or rail panel, mark a point, or play/pause the replay. Combine several changes in one call. Use it to show the user what an answer refers to.",
  schema: z.object({
    flyTo: z
      .object({
        ...point,
        zoom: z
          .number()
          .min(8)
          .max(17)
          .optional()
          .describe("Map zoom, 8 (whole region) to 17 (a block). ~14 frames a neighborhood."),
      })
      .optional()
      .describe("Ease the camera to this point."),
    time: z
      .string()
      .optional()
      .describe("Replay time, UTC ISO-8601 (clamped to the fire's replay window)."),
    showLayers: z.array(z.enum(MAP_LAYER_IDS)).optional().describe("Layers to turn on."),
    hideLayers: z.array(z.enum(MAP_LAYER_IDS)).optional().describe("Layers to turn off."),
    tab: z
      .enum(MAP_TABS)
      .optional()
      .describe("Top tab: incident (replay), drones (footage + live detector), risk (debris flows)."),
    railTab: z
      .enum(RAIL_TABS)
      .optional()
      .describe("Incident tab's right-rail panel."),
    viewMode: z.enum(["2d", "3d"]).optional(),
    highlight: z
      .object({ ...point, label: z.string().max(80).optional() })
      .nullable()
      .optional()
      .describe("Mark a point with a pulsing pin and label; null clears it."),
    playing: z.boolean().optional().describe("Start or pause the replay."),
  }),
  http: false,
  retrySafe: true,
  run: async (args) => {
    if (args.time !== undefined && !Number.isFinite(Date.parse(args.time))) {
      fail(`time must be an ISO-8601 time, got ${JSON.stringify(args.time)}`, {
        errorCode: "invalid_time",
        statusCode: 400,
      });
    }
    const command: MapCommand = { ...args };
    const changed = Object.keys(command);
    if (changed.length === 0) {
      fail("Nothing to change: pass at least one field.", {
        errorCode: "empty_command",
        statusCode: 400,
      });
    }
    command._writeId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await writeAppStateForCurrentTab(MAP_COMMAND_KEY, command as Record<string, unknown>);
    return {
      message: `Map updated: ${changed.join(", ")}. The user's map applies it within a couple of seconds; call view-screen to confirm.`,
      command,
    };
  },
});
