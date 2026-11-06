import { ClientOnly } from "@agent-native/toolkit/app/shared";
import { lazy, Suspense } from "react";
import { useParams } from "react-router";

import { fireTitle } from "@shared/fires";

// deck.gl, onnxruntime-web and the stores read `window` at import time, so the
// whole incident UI loads in the browser only; SSR renders the loading frame.
const SentinelApp = lazy(() => import("@/sentinel/SentinelApp"));

export function meta({ params }: { params: { fireId?: string } }) {
  const title = `${fireTitle(params.fireId)} · Sentinel Ember`;
  return [
    { title },
    {
      name: "description",
      content:
        "Wildfire reconstruction on 3D terrain with an agent that reads the same fire data and drives the same map you see.",
    },
  ];
}

function Loading() {
  return (
    <div className="sentinel-root flex items-center justify-center text-sm">
      <span className="text-se-muted">Loading fire data…</span>
    </div>
  );
}

export default function FireRoute() {
  const { fireId } = useParams();
  return (
    <ClientOnly fallback={<Loading />}>
      <Suspense fallback={<Loading />}>
        <SentinelApp key={fireId} />
      </Suspense>
    </ClientOnly>
  );
}
