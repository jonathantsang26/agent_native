import { defineAction } from "@agent-native/core/action";
import { accessFilter } from "@agent-native/core/sharing";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { FIRE_IDS } from "../shared/fires.js";
import { getDb, schema } from "../server/db/index.js";

export default defineAction({
  description: "List saved incident briefs for a fire, newest first.",
  schema: z.object({
    fire: z.enum(FIRE_IDS).describe("Fire id: eaton or palisades."),
    limit: z.coerce.number().int().min(1).max(100).default(30),
  }),
  http: { method: "GET" },
  readOnly: true,
  run: async ({ fire, limit }) => {
    const { briefs, briefShares } = schema;
    const rows = await getDb()
      .select({
        id: briefs.id,
        fire: briefs.fire,
        title: briefs.title,
        body: briefs.body,
        replayTime: briefs.replayTime,
        lon: briefs.lon,
        lat: briefs.lat,
        zoom: briefs.zoom,
        createdAt: briefs.createdAt,
        ownerEmail: briefs.ownerEmail,
      })
      .from(briefs)
      .where(and(eq(briefs.fire, fire), accessFilter(briefs, briefShares)))
      .orderBy(desc(briefs.createdAt))
      .limit(limit);
    return { briefs: rows };
  },
});
