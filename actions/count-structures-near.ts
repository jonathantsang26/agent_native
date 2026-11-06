import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { fireArg, latArg, lonArg, runTool } from "../server/lib/fire/run.js";

export default defineAction({
  description:
    "Counts of inspected structures within a radius of a point, by damage category, with roof, vent, eave and window breakdowns. Never identifies individual homes.",
  schema: z.object({
    fire: fireArg,
    lon: lonArg,
    lat: latArg,
    radius_m: z.coerce.number().min(25).max(2000).optional().describe("Radius in meters, 25 to 2000. Default 500."),
  }),
  http: { method: "GET" },
  readOnly: true,
  mcpTool: true,
  run: async ({ fire, lon, lat, radius_m }) => runTool(fire, "structures_near", { lon, lat, radius_m }),
});
