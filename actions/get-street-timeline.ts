import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { fireArg, runTool } from "../server/lib/fire/run.js";

export default defineAction({
  description:
    "When the fire reached a named street: walks every segment of the street through the arrival raster and returns the first and last burn times with their locations, and the burned fraction of the sampled points.",
  schema: z.object({
    fire: fireArg,
    name: z.string().min(1).max(200).describe('Street name, e.g. "Lake Ave" or "North Lake Avenue".'),
  }),
  http: { method: "GET" },
  readOnly: true,
  mcpTool: true,
  run: async ({ fire, name }) => runTool(fire, "street_fire_timeline", { name }),
});
