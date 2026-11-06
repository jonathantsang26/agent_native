import {useEffect} from 'react';
import {AgentMapBridge} from '../agent/bridge';
import {useFireData} from '../data/fire';
import {Dock} from '../dock/Dock';
import {LivePlayer} from '../drones/live/LivePlayer';
import {FootagePlayer} from '../drones/Player';
import {Header} from '../header/Header';
import {Rail} from '../rail/Rail';
import {Stage} from '../stage/Stage';
import {startClock} from '../state/time';

/** Header 40 / [stage + dock | rail 308]. */
export function AppShell() {
  const {data, error} = useFireData();

  useEffect(() => startClock(), []);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm">
        <div>
          <div className="font-semibold">Couldn't load fire data</div>
          <div className="mt-1 font-mono text-xs text-se-muted">{error}</div>
        </div>
      </div>
    );
  }
  if (!data) {
    return <div className="flex h-full items-center justify-center text-sm text-se-muted">Loading fire data…</div>;
  }

  return (
    <div className="flex h-full flex-col">
      <AgentMapBridge fire={data} />
      <Header fire={data} />
      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            <Stage fire={data} />
            <FootagePlayer fire={data} />
            <LivePlayer fire={data} />
          </div>
          <Dock fire={data} />
        </div>
        <Rail fire={data} />
      </div>
    </div>
  );
}
