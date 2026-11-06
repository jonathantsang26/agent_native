import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { fireArg, runTool } from "../server/lib/fire/run.js";

export default defineAction({
  description:
    "House-level associations between construction features (vents, eaves, roof, window_pane, siding, fences, decks, patio covers) and destruction, adjusted for exposure. Associations only, never effects.",
  schema: z.object({
    fire: fireArg,
    feature: z.string().max(40).optional().describe('Optional feature, e.g. "vents" or "roof". Omit for all.'),
  }),
  http: { method: "GET" },
  readOnly: true,
  mcpTool: true,
  run: async ({ fire, feature }) => runTool(fire, "exposure_stats", { feature }),
});
