import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { fireArg, runTool } from "../server/lib/fire/run.js";

export default defineAction({
  description:
    "The model estimate of where and when the fire started (a statistical back-trace from the mapped perimeters, not an investigated origin), with its 90% region and hold-out errors.",
  schema: z.object({
    fire: fireArg,
  }),
  http: { method: "GET" },
  readOnly: true,
  mcpTool: true,
  run: async ({ fire }) => runTool(fire, "ignition_summary", {}),
});
