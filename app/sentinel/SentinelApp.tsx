import { useEffect } from "react";
import { useParams } from "react-router";

import { AppShell } from "./app/AppShell";
import { FIRE_ID } from "./data/fire";

/** Client-only entry for the incident UI, loaded lazily by the /fires/:fireId route. */
export default function SentinelApp() {
  const { fireId } = useParams();
  // The map's stores are module singletons keyed to the fire read at load, so a
  // client-side route change to another fire (a link, or the agent's navigate)
  // reloads the page instead of mixing two fires' data.
  const stale = fireId !== undefined && fireId !== FIRE_ID;
  useEffect(() => {
    if (stale) window.location.assign(window.location.href);
  }, [stale]);
  if (stale) return <div className="sentinel-root" />;
  return (
    <div className="sentinel-root">
      <AppShell />
    </div>
  );
}
