import {sendToAgentChat} from '@agent-native/core/client/agent-chat';
import {useActionMutation, useActionQuery} from '@agent-native/core/client/hooks';
import {applyMapCommand} from '../agent/bridge';
import type {FireData} from '../data/fire';
import {formatDateTime, zoneLabel} from '../lib/format';
import {useTime} from '../state/time';

type Brief = {
  id: string;
  title: string;
  body: string;
  replayTime: string | null;
  lon: number | null;
  lat: number | null;
  zoom: number | null;
  createdAt: string;
};

const SOURCE_TAG = /(\[\s*s[0-9a-z]{2,8}(?:\s*[,;]\s*s[0-9a-z]{2,8})*\s*\])/gi;

/** Brief text with its [source ids] set apart, so claims and their evidence read separately. */
function BriefBody({text}: {text: string}) {
  return (
    <p className="mt-1 whitespace-pre-wrap text-sm leading-snug text-ink">
      {text.split(SOURCE_TAG).map((part, i) =>
        i % 2 ? (
          <span key={i} className="font-mono text-2xs text-se-muted">
            {part}
          </span>
        ) : (
          part
        )
      )}
    </p>
  );
}

/** Saved situation reports for this fire; the agent writes them with save-brief and they appear live. */
export function BriefsPanel({fire}: {fire: FireData}) {
  const tz = fire.aoi.timezone;
  const {data, isLoading, error} = useActionQuery('list-briefs', {fire: fire.id as 'eaton' | 'palisades', limit: 30});
  const remove = useActionMutation('delete-brief');
  const briefs = ((data as {briefs?: Brief[]} | undefined)?.briefs ?? []) as Brief[];

  const show = (b: Brief) =>
    applyMapCommand({
      ...(b.replayTime ? {time: b.replayTime} : {}),
      ...(b.lon != null && b.lat != null
        ? {flyTo: {lon: b.lon, lat: b.lat, zoom: b.zoom ?? 14}, highlight: {lon: b.lon, lat: b.lat, label: b.title}}
        : {})
    });

  const draft = () => {
    const t = useTime.getState().t;
    sendToAgentChat({
      message: `Write an incident brief for the ${fire.aoi.name} at the replay time on my screen: fire size and spread, the wind, and the damage where the fire was burning. Save it with save-brief and show me where it is about.`,
      context: `Replay time on screen: ${new Date(t).toISOString()} (${formatDateTime(t, tz)} ${zoneLabel(t, tz)}).`,
      submit: true,
      openSidebar: true
    });
  };

  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-se-muted">
          Situation reports the agent wrote from the fire data. Claims carry their source ids.
        </span>
      </div>
      <button
        onClick={draft}
        className="mt-2 w-full rounded bg-btndark px-2 py-1.5 text-left text-sm font-medium text-white hover:brightness-110"
      >
        Draft a brief for the time on screen
      </button>
      {isLoading && <div className="mt-3 text-sm text-se-muted">Loading briefs…</div>}
      {error && <div className="mt-3 text-sm text-live">Couldn't load briefs: {String((error as Error).message ?? error)}</div>}
      {!isLoading && !error && briefs.length === 0 && (
        <div className="mt-3 text-sm text-se-muted">No briefs for this fire yet.</div>
      )}
      <ul className="mt-2 space-y-2">
        {briefs.map(b => (
          <li key={b.id} className="rounded bg-tabactive p-2 shadow-[0_0_0_1px_var(--hairline)]">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-ink">{b.title}</div>
                {b.replayTime && (
                  <div className="font-mono text-2xs text-se-muted">
                    {formatDateTime(Date.parse(b.replayTime), tz)} {zoneLabel(Date.parse(b.replayTime), tz)}
                  </div>
                )}
              </div>
              <button
                onClick={() => remove.mutate({id: b.id})}
                disabled={remove.isPending}
                className="px-1 text-se-muted hover:text-ink"
                aria-label={`Delete brief ${b.title}`}
                title="Delete"
              >
                ×
              </button>
            </div>
            <BriefBody text={b.body} />
            {(b.replayTime || b.lon != null) && (
              <button onClick={() => show(b)} className="mt-1.5 text-xs font-medium text-se-accent hover:underline">
                Show on map
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
