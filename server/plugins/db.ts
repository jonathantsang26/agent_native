import { runMigrations } from "@agent-native/core/db";

// Append new entries; never edit one that has run.
export default runMigrations(
  [
    {
      version: 1,
      name: "briefs",
      sql: `CREATE TABLE IF NOT EXISTS briefs (
  id TEXT PRIMARY KEY,
  fire TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  replay_time TEXT,
  lon DOUBLE PRECISION,
  lat DOUBLE PRECISION,
  zoom DOUBLE PRECISION,
  created_at TEXT NOT NULL DEFAULT (now()),
  owner_email TEXT NOT NULL DEFAULT 'local@localhost',
  org_id TEXT,
  visibility TEXT NOT NULL DEFAULT 'private'
);
CREATE TABLE IF NOT EXISTS brief_shares (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL,
  principal_type TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (now()),
  notified_at TEXT
);
CREATE INDEX IF NOT EXISTS briefs_owner_org_fire_idx ON briefs (owner_email, org_id, fire, created_at);
CREATE INDEX IF NOT EXISTS brief_shares_resource_idx ON brief_shares (resource_id, principal_type, principal_id)`,
    },
  ],
  { table: "sentinel_app_migrations" },
);
