import { createSharesTable, ownableColumns } from "@agent-native/core/db/schema";
import { sql } from "drizzle-orm";
import { doublePrecision, pgTable, text } from "drizzle-orm/pg-core";

/**
 * Incident briefs: short situation reports about one fire at one moment,
 * written by the agent (or a person) from the fire actions' results. Times are
 * ISO text so string order is time order.
 */
export const briefs = pgTable("briefs", {
  id: text("id").primaryKey(),
  fire: text("fire").notNull(),
  title: text("title").notNull(),
  /** Markdown; claims carry the [source ids] the fire actions returned. */
  body: text("body").notNull(),
  /** The replay moment the brief describes (UTC ISO), if any. */
  replayTime: text("replay_time"),
  /** Where the map should look when the brief is opened. */
  lon: doublePrecision("lon"),
  lat: doublePrecision("lat"),
  zoom: doublePrecision("zoom"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`now()`),
  ...ownableColumns(),
});
export const briefShares = createSharesTable("brief_shares");
