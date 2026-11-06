import { defineAction } from "@agent-native/core/action";
import { assertAccess } from "@agent-native/core/sharing";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb, schema } from "../server/db/index.js";

export default defineAction({
  description: "Delete an incident brief the current user owns.",
  schema: z.object({ id: z.string().min(1).describe("Brief id from list-briefs") }),
  needsApproval: (_args, ctx) => ctx?.caller === "tool",
  run: async ({ id }) => {
    await assertAccess("brief", id, "owner");
    await getDb().delete(schema.briefs).where(eq(schema.briefs.id, id));
    return { id, message: "Brief deleted." };
  },
});
