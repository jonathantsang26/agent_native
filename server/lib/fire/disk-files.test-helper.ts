import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { FireStore, type FireFiles } from "./data.js";

/** Reads <root>/public/data/<fire>/ from disk; tests only (server code reads the bundled set). */
export function diskFiles(fire: string, root = process.cwd()): FireFiles {
  const dir = path.join(root, "public", "data", fire);
  const file = (name: string) => path.join(dir, name);
  return {
    json: (name) =>
      existsSync(file(name)) ? JSON.parse(readFileSync(file(name), "utf8")) : undefined,
    bytes: (name) => (existsSync(file(name)) ? readFileSync(file(name)) : undefined),
  };
}

export function diskStore(fire: string, root?: string): FireStore {
  return new FireStore(fire, diskFiles(fire, root));
}
