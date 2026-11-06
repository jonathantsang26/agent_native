import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { fireArg, latArg, lonArg, runTool } from "../server/lib/fire/run.js";

export default defineAction({
  description:
    "When the fire reached a point: burned or not, arrival time (UTC and local), confidence 0-1, and whether the point is inside the final perimeter.",
  schema: z.object({
    fire: fireArg,
    lon: lonArg,
    lat: latArg,
  }),
  http: { method: "GET" },
  readOnly: true,
  mcpTool: true,
  run: async ({ fire, lon, lat }) => runTool(fire, "arrival_at", { lon, lat }),
});
