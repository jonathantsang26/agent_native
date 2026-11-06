import { AppShell } from "./app/AppShell";

/** Client-only entry for the incident UI, loaded lazily by the /fires/:fireId route. */
export default function SentinelApp() {
  return (
    <div className="sentinel-root">
      <AppShell />
    </div>
  );
}
