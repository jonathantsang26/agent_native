import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { fireArg, runTool } from "../server/lib/fire/run.js";

export default defineAction({
  description:
    "Key events of the fire (reported start, rapid growth, spot fires, peak gust, containment...) with times and locations.",
  schema: z.object({
    fire: fireArg,
  }),
  http: { method: "GET" },
  readOnly: true,
  mcpTool: true,
  run: async ({ fire }) => runTool(fire, "events", {}),
});
