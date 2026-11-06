import { sendToAgentChat, setAgentChatContextItem } from "@agent-native/core/client/agent-chat";
import { useEffect } from "react";

import type { FireData } from "../data/fire";
import { formatDateTime, formatLatLon, zoneLabel } from "../lib/format";
import { useTime } from "../state/time";
import { useUi } from "../state/ui";

const round = (v: number) => Math.round(v * 1e5) / 1e5;

/**
 * The menu a click on bare terrain opens: hand the spot to the agent, either as
 * a question or as context for the next message. The pin itself is published
 * to the agent with the rest of the map state (see bridge.tsx).
 */
export function SpotMenu({ fire }: { fire: FireData }) {
  const pin = useUi((s) => s.pin);
  const setPin = useUi((s) => s.setPin);

  useEffect(() => {
    if (!pin) return;
    const close = (e: KeyboardEvent) => e.key === "Escape" && setPin(null);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [pin, setPin]);

  if (!pin) return null;

  const lon = round(pin.lon);
  const lat = round(pin.lat);
  const t = useTime.getState().t;
  const tz = fire.aoi.timezone;
  const when = `${formatDateTime(t, tz)} ${zoneLabel(t, tz)}`;
  const context = `The user picked a point on the ${fire.aoi.name} map: lon ${lon}, lat ${lat}. Replay time on screen: ${new Date(t).toISOString()} (${when}).`;

  const mark = () => useUi.getState().setHighlight({ lon, lat, label: "Picked spot" });

  const ask = () => {
    mark();
    setPin(null);
    sendToAgentChat({
      message:
        "What happened at this spot? When did the fire reach it, what was the wind doing then, and how many structures nearby were damaged?",
      context,
      submit: true,
      openSidebar: true,
    });
  };

  const attach = () => {
    mark();
    setPin(null);
    setAgentChatContextItem({ key: "picked-spot", title: `Spot ${formatLatLon(lat, lon)}`, context });
    sendToAgentChat({ message: "", context, contextLabel: "Picked spot", submit: false, openSidebar: true });
  };

  return (
    <div
      className="absolute z-20 w-56 rounded-md bg-hud p-2 text-xs text-white shadow-lg"
      style={{ left: Math.max(8, pin.x + 10), top: Math.max(8, pin.y + 10) }}
      role="dialog"
      aria-label="Picked spot"
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-2xs text-white/70">{formatLatLon(lat, lon)}</span>
        <button
          onClick={() => setPin(null)}
          className="px-1 text-white/60 hover:text-white"
          aria-label="Close"
        >
          ×
        </button>
      </div>
      <button
        onClick={ask}
        className="mt-1.5 w-full rounded bg-se-accent px-2 py-1.5 text-left font-medium text-white hover:brightness-110"
      >
        Ask the agent about this spot
      </button>
      <button
        onClick={attach}
        className="mt-1 w-full rounded px-2 py-1 text-left text-white/80 hover:bg-white/10"
      >
        Add as context to my next question
      </button>
    </div>
  );
}
