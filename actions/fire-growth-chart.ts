import { defineAction } from "@agent-native/core/action";
import { ACTION_CHAT_UI_DATA_WIDGET_RENDERER } from "@agent-native/core/action-ui";
import { createDataChartWidgetResult } from "@agent-native/core/data-widgets";
import { z } from "zod";

import { fireArg, storeFor } from "../server/lib/fire/run.js";
import { localLabel } from "../server/lib/fire/time.js";

type Series = { t: string[]; area_acres: number[]; ros_chains_hr: number[] };

const METRICS = {
  area: { key: "acres", label: "Burned area (acres)", field: "area_acres" },
  spread: { key: "chains_hr", label: "Head rate of spread (chains/h)", field: "ros_chains_hr" },
} as const;

export default defineAction({
  description:
    "Chart the fire's growth over the replay window in the chat: burned area (acres) or head rate of spread, every few hours. Use it when the user asks how fast or how large the fire grew.",
  schema: z.object({
    fire: fireArg,
    metric: z
      .enum(["area", "spread"])
      .default("area")
      .describe("area = cumulative burned acres; spread = head rate of spread."),
    everyHours: z.coerce
      .number()
      .int()
      .min(1)
      .max(12)
      .default(3)
      .describe("Sampling interval in hours (the chart shows at most 48 points)."),
  }),
  http: { method: "GET" },
  readOnly: true,
  chatUI: {
    renderer: ACTION_CHAT_UI_DATA_WIDGET_RENDERER,
    title: "Fire growth",
  },
  run: async ({ fire, metric, everyHours }) => {
    const store = await storeFor(fire);
    const tz = store.aoi().timezone;
    const series = store.json<Series>("series.json");
    const m = METRICS[metric];
    const values = series[m.field];
    const step = Math.max(everyHours, Math.ceil(series.t.length / 48));
    const data = series.t
      .map((t, i) => ({ t, v: values[i] }))
      .filter((_, i) => i % step === 0 || i === series.t.length - 1)
      .map(({ t, v }) => ({
        time: localLabel(Date.parse(t), tz).replace(/^\w+, /, "").replace(/, \d{4},/, ""),
        [m.key]: Math.round((v ?? 0) * 10) / 10,
      }));
    const peak = Math.max(...values.filter(Number.isFinite));
    return createDataChartWidgetResult({
      widgetId: "sentinel.fireGrowth.v1",
      title: `${store.aoi().name}: ${m.label.toLowerCase()}`,
      summary: {
        fire: store.fire,
        metric,
        points: data.length,
        first: data[0],
        last: data[data.length - 1],
        peak,
        note: "From the arrival raster's hourly series (modeled between mapped perimeters).",
      },
      display: {
        description: `Every ${step} h, local time. Modeled between mapped perimeters.`,
        sources: [{ label: `${store.fire}/series.json (arrival-raster series)` }],
      },
      chartSeries: {
        type: metric === "area" ? "area" : "line",
        xKey: "time",
        series: [{ key: m.key, label: m.label, color: "#c0563a" }],
        data,
        yAxisTitle: m.label,
        contentHeight: 220,
      },
    });
  },
});
