/** Fires with data under public/data/<id>/. Shared by routes, actions and the map UI. */
export const FIRE_IDS = ["eaton", "palisades"] as const;
export type FireId = (typeof FIRE_IDS)[number];

export const DEFAULT_FIRE: FireId = "eaton";

export const FIRE_NAMES: Record<FireId, string> = {
  eaton: "Eaton Fire",
  palisades: "Palisades Fire",
};

export function isFireId(value: unknown): value is FireId {
  return typeof value === "string" && (FIRE_IDS as readonly string[]).includes(value);
}

export function fireTitle(id: string | undefined): string {
  return isFireId(id) ? FIRE_NAMES[id] : "Fire";
}

export function firePath(id: FireId): string {
  return `/fires/${id}`;
}
