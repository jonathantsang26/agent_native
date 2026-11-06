import { resolveCredential } from "@agent-native/core/credentials";
import { getSession } from "@agent-native/core/server";
import {
  defineEventHandler,
  getRequestIP,
  readRawBody,
  setResponseHeader,
  setResponseStatus,
} from "h3";

import { handleSam, MAX_BODY } from "../../lib/sam/handler.js";

/**
 * Outlines fire in one live drone frame with SAM 3.1. The browser's detector
 * calls it at most every ~2 s while it sees flames; see server/lib/sam/handler.ts
 * for the request shape, the spend cap and the rate limits.
 *
 * A route rather than an action: it takes a raw ~1 MB JPEG data URL per frame
 * and is called by the video loop, not by the agent.
 */
export default defineEventHandler(async (event) => {
  const session = await getSession(event);
  if (!session?.email) {
    setResponseStatus(event, 401);
    return { error: "Sign in to use live outlines." };
  }
  setResponseHeader(event, "Cache-Control", "no-store");

  const raw = await readRawBody(event, "utf8");
  if (raw && raw.length > MAX_BODY) {
    setResponseStatus(event, 413);
    return { error: "Body too large." };
  }
  let body: unknown;
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    setResponseStatus(event, 400);
    return { error: "Body is not valid JSON." };
  }

  const key = await resolveCredential("MODEL_API_KEY", {
    userEmail: session.email,
    orgId: session.orgId ?? null,
  }).catch(() => null);
  const out = await handleSam(
    body,
    { ...process.env, MODEL_API_KEY: key ?? undefined },
    { client: getRequestIP(event, { xForwardedFor: true }) ?? "unknown" },
  );
  for (const [k, v] of Object.entries(out.headers ?? {})) setResponseHeader(event, k, v);
  setResponseStatus(event, out.status);
  return out.body;
});
