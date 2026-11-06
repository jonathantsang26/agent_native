import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { fireArg, runTool, timeArg } from "../server/lib/fire/run.js";

export default defineAction({
  description:
    "Fire size (acres) and head rate of spread at the nearest hour to t, plus the head position when known.",
  schema: z.object({
    fire: fireArg,
    t: timeArg,
  }),
  http: { method: "GET" },
  readOnly: true,
  mcpTool: true,
  run: async ({ fire, t }) => runTool(fire, "fire_state_at", { t }),
});
