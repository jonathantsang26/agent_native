import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";

import { FIRE_IDS } from "../shared/fires.js";
import { getDb, schema } from "../server/db/index.js";
import { screenFire } from "../server/lib/fire/run.js";
import { containsAddress, mentionsCause } from "../server/lib/fire/verify.js";

export default defineAction({
  description:
    "Save an incident brief: a short situation report about one fire at one moment, shown in the map's Briefs panel. Gather the facts with the fire actions first; the body must use only figures they returned, each tagged with its [source id]. Include where and when the brief is about so opening it can move the map there.",
  schema: z.object({
    fire: z
      .enum(FIRE_IDS)
      .optional()
      .describe("Fire id. Omit to use the fire on the user's screen."),
    title: z.string().min(3).max(120).describe('Short title, e.g. "Altadena, 4 AM Jan 8"'),
    body: z
      .string()
      .min(20)
      .max(4000)
      .describe("Markdown, a few short paragraphs or bullets, figures tagged with [source ids]."),
    replayTime: z
      .string()
      .optional()
      .describe("The moment the brief describes, UTC ISO-8601."),
    lon: z.number().min(-180).max(180).optional(),
    lat: z.number().min(-90).max(90).optional(),
    zoom: z.number().min(8).max(17).optional(),
  }),
  run: async (args, ctx) => {
    const ownerEmail =
      ctx?.userEmail ?? fail("Sign in to save briefs.", { statusCode: 401 });
    if (args.replayTime !== undefined && !Number.isFinite(Date.parse(args.replayTime))) {
      fail(`replayTime must be an ISO-8601 time, got ${JSON.stringify(args.replayTime)}`, {
        errorCode: "invalid_time",
        statusCode: 400,
      });
    }
    if ((args.lon === undefined) !== (args.lat === undefined)) {
      fail("Pass lon and lat together.", { errorCode: "invalid_location", statusCode: 400 });
    }
    // The same rules the response guard holds answers to, enforced at the write.
    const text = `${args.title}\n${args.body}`;
    if (mentionsCause(text)) {
      fail("The brief discusses what caused or started the fire. Leave cause out; the data covers when and where it spread.", {
        errorCode: "cause_speculation",
        statusCode: 400,
      });
    }
    if (containsAddress(text)) {
      fail("The brief includes a street address. Describe places by street or neighborhood only.", {
        errorCode: "address",
        statusCode: 400,
      });
    }
    const orgId = ctx?.orgId ?? null;
    const brief = {
      id: crypto.randomUUID(),
      fire: args.fire ?? (await screenFire()),
      title: args.title.trim(),
      body: args.body.trim(),
      replayTime: args.replayTime ? new Date(args.replayTime).toISOString() : null,
      lon: args.lon ?? null,
      lat: args.lat ?? null,
      zoom: args.zoom ?? null,
      ownerEmail,
      orgId,
      visibility: orgId ? ("org" as const) : ("private" as const),
    };
    await getDb().insert(schema.briefs).values(brief);
    return {
      id: brief.id,
      message: `Saved brief "${brief.title}". It is in the Briefs panel of the incident rail (update-map railTab "Briefs" shows it).`,
    };
  },
});
