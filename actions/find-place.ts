import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { fireArg, runTool } from "../server/lib/fire/run.js";

export default defineAction({
  description:
    "Find a street, neighborhood, peak or water feature in the fire area by name. Returns up to 5 matches with lon/lat. Call it before any action that needs coordinates.",
  schema: z.object({
    fire: fireArg,
    name: z.string().min(1).max(200).describe('Place or street name, e.g. "Lake Ave" or "Mount Wilson".'),
  }),
  http: { method: "GET" },
  readOnly: true,
  mcpTool: true,
  run: async ({ fire, name }) => runTool(fire, "place_lookup", { name }),
});
