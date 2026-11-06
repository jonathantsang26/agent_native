import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { fireArg, runTool, timeArg } from "../server/lib/fire/run.js";

export default defineAction({
  description:
    "Hourly wind speed, gust, direction, temperature and relative humidity at the nearest hour to t (HRRR at the fire-area center).",
  schema: z.object({
    fire: fireArg,
    t: timeArg,
  }),
  http: { method: "GET" },
  readOnly: true,
  mcpTool: true,
  run: async ({ fire, t }) => runTool(fire, "weather_at", { t }),
});
