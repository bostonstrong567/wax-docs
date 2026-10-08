'use client';

import { useEffect, useState } from 'react';

// Written every ten minutes by the server that reads each new build of the game.
const STATUS_URL = 'https://wax-icarus.duckdns.org/game/status.json';

type Status = {
  state: 'current' | 'building' | 'failed' | 'unreachable';
  checked: string;
  up_to_date: boolean;
  steam?: { client_build?: string; updated?: string; dlc?: number };
  sdk?: { game_version?: string; made?: string; counts?: Record<string, number> } | null;
};

const STATES: Record<Status['state'], string> = {
  current: 'Up to date with the game',
  building: 'A new build of the game is being read now',
  failed: 'The newest build could not be read yet',
  unreachable: 'Steam did not answer the last time it was asked',
};

function Row({ name, value }: { name: string; value?: string | number | null }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="flex justify-between gap-4 border-b border-fd-border py-2 text-sm last:border-b-0">
      <span className="text-fd-muted-foreground">{name}</span>
      <span className="text-right font-medium">{typeof value === 'number' ? value.toLocaleString('en-US') : value}</span>
    </div>
  );
}

export function GameStatus() {
  const [status, setStatus] = useState<Status | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const stop = new AbortController();
    fetch(STATUS_URL, { signal: stop.signal, cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('no status'))))
      .then((body: Status) => setStatus(body))
      .catch(() => {
        if (!stop.signal.aborted) setFailed(true);
      });
    return () => stop.abort();
  }, []);

  if (failed) return <p className="text-sm text-fd-muted-foreground">The status cannot be read right now.</p>;
  if (!status) return <p className="text-sm text-fd-muted-foreground">Reading the status.</p>;

  const counts = status.sdk?.counts ?? {};
  return (
    <div className="not-prose my-4 rounded-lg border border-fd-border bg-fd-card px-4 py-2">
      <Row name="State" value={STATES[status.state] ?? status.state} />
      <Row name="Game version read" value={status.sdk?.game_version} />
      <Row name="Read on" value={status.sdk?.made} />
      <Row name="Steam build of the game" value={status.steam?.client_build} />
      <Row name="Game last updated on Steam" value={status.steam?.updated} />
      <Row name="DLCs Steam lists" value={status.steam?.dlc} />
      <Row name="Classes" value={counts.classes} />
      <Row name="Blueprint classes" value={counts.blueprint_classes} />
      <Row name="Functions" value={counts.functions} />
      <Row name="Variables" value={counts.properties} />
      <Row name="Steam last asked" value={status.checked} />
    </div>
  );
}
