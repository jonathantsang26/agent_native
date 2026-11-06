import { fail } from "@agent-native/core/action";
import { readAppStateForCurrentTab } from "@agent-native/core/application-state";
import { z } from "zod";

import { DEFAULT_FIRE, FIRE_IDS, isFireId, type FireId } from "../../../shared/fires.js";
import { MissingDataError, type FireStore } from "./data.js";
import { getFireStore } from "./store.js";
import { runFireTool, ToolArgError, type Source } from "./tools.js";

/** The incident map's state as the UI publishes it (see app/sentinel/agent/bridge.ts). */
export const MAP_STATE_KEY = "incident-map";
/** One-shot commands the UI applies to the map, then deletes. */
export const MAP_COMMAND_KEY = "map-command";

export const fireArg = z
  .enum(FIRE_IDS)
  .optional()
  .describe("Fire id (eaton or palisades). Omit to use the fire on the user's screen.");

export const lonArg = z.coerce
  .number()
  .min(-180)
  .max(180)
  .describe("Longitude, decimal degrees (negative west).");
export const latArg = z.coerce
  .number()
  .min(-90)
  .max(90)
  .describe("Latitude, decimal degrees.");
export const timeArg = z
  .string()
  .describe("UTC ISO-8601 time, e.g. 2025-01-08T06:00:00Z.");

export async function readMapState(): Promise<Record<string, unknown> | null> {
  try {
    return await readAppStateForCurrentTab(MAP_STATE_KEY, { fallbackToGlobal: true });
  } catch {
    // No browser tab behind this call (HTTP, MCP, CLI): there is no screen to read.
    return null;
  }
}

/** The fire the user is looking at, or the default fire when no screen is attached. */
export async function screenFire(): Promise<FireId> {
  const state = await readMapState();
  return isFireId(state?.fire) ? state.fire : DEFAULT_FIRE;
}

export async function storeFor(fire: FireId | undefined): Promise<FireStore> {
  return getFireStore(fire ?? (await screenFire()));
}

export type FireToolResult = {
  fire: string;
  result: unknown;
  sources: Source[];
  how_to_cite: string;
};

/** Runs one fire tool for an action and maps its errors onto action failures. */
export async function runTool(
  fire: FireId | undefined,
  name: string,
  args: Record<string, unknown>,
): Promise<FireToolResult> {
  const store = await storeFor(fire);
  try {
    const { result, sources } = runFireTool(store, name, args);
    return {
      fire: store.fire,
      result,
      sources,
      how_to_cite:
        "Quote only numbers and times that appear in `result`, and tag each claim with its source id in brackets, e.g. [" +
        (sources[0]?.id ?? "s1abc") +
        "].",
    };
  } catch (e) {
    if (e instanceof ToolArgError) {
      fail(e.message, { errorCode: "invalid_arguments", statusCode: 400 });
    }
    if (e instanceof MissingDataError) {
      fail(e.message, { errorCode: "missing_data", statusCode: 404 });
    }
    throw e;
  }
}
