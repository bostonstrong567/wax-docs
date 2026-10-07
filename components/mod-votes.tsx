'use client';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getVote, sendVote, type Vote, type Voted, type Votes } from '@/lib/market';

const PRESSED = 'border-fd-primary bg-fd-primary/10 text-fd-primary';
const NOT_PRESSED = 'bg-fd-card text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-accent-foreground';
const REMEMBERED = 'wax-votes';

// The counts as they are once the visitor's vote has changed to this one.
function moved({ votes, mine }: Voted, vote: Vote): Voted {
  return {
    mine: vote,
    votes: {
      up: Math.max(0, votes.up - (mine === 1 ? 1 : 0) + (vote === 1 ? 1 : 0)),
      down: Math.max(0, votes.down - (mine === -1 ? 1 : 0) + (vote === -1 ? 1 : 0)),
    },
  };
}

function allRemembered(): Record<string, unknown> {
  try {
    const kept: unknown = JSON.parse(localStorage.getItem(REMEMBERED) ?? '{}');
    return kept !== null && typeof kept === 'object' ? (kept as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

// The vote this browser last sent for a mod. The list shows it without asking the catalogue for every card.
function remembered(id: string): Vote {
  const vote = allRemembered()[id];
  return vote === 1 || vote === -1 ? vote : 0;
}

function remember(id: string, vote: Vote) {
  try {
    const kept = allRemembered();
    if (vote === 0) delete kept[id];
    else kept[id] = vote;
    localStorage.setItem(REMEMBERED, JSON.stringify(kept));
  } catch {
    // a browser that keeps nothing still votes
  }
}

// compact: the small pair on a card of the list. Without it: the two buttons on a mod's own page.
export function VoteButtons({ id, first, compact = false }: { id: string; first: Votes; compact?: boolean }) {
  const [voted, setVoted] = useState<Voted>({ votes: first, mine: 0 });
  const [error, setError] = useState('');
  const pressed = useRef(false);
  const busy = useRef(false);

  // The visitor's own vote. An answer that comes after a press is dropped.
  useEffect(() => {
    if (compact) {
      const mine = remembered(id);
      if (mine !== 0) setVoted((now) => (pressed.current ? now : { votes: now.votes, mine }));
      return;
    }
    const controller = new AbortController();
    getVote(id, controller.signal).then((answer) => {
      if (!answer || controller.signal.aborted || pressed.current) return;
      setVoted(answer);
      remember(id, answer.mine);
    });
    return () => controller.abort();
  }, [id, compact]);

  async function press(wanted: 1 | -1) {
    if (busy.current) return;
    busy.current = true;
    pressed.current = true;
    const before = voted;
    const vote = voted.mine === wanted ? 0 : wanted;
    setError('');
    setVoted(moved(voted, vote));
    const answer = await sendVote(id, vote);
    busy.current = false;
    if ('error' in answer) {
      setVoted(before);
      setError(answer.error);
    } else {
      setVoted(answer);
      remember(id, answer.mine);
    }
  }

  const shape = compact
    ? 'gap-1 px-2.5 py-1 text-xs first:rounded-l-full last:rounded-r-full last:-ml-px'
    : 'gap-1.5 rounded-lg px-3 py-1.5 text-sm';
  const button = (wanted: 1 | -1, label: string, amount: number) => (
    <button
      type="button"
      aria-label={label}
      aria-pressed={voted.mine === wanted}
      onClick={() => press(wanted)}
      className={`inline-flex items-center border tabular-nums transition-colors outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-fd-ring ${shape} ${
        voted.mine === wanted ? `${PRESSED} z-[1]` : NOT_PRESSED
      }`}
    >
      {wanted === 1 ? (
        <ThumbsUp aria-hidden="true" className={compact ? 'size-3.5' : 'size-4'} />
      ) : (
        <ThumbsDown aria-hidden="true" className={compact ? 'size-3.5' : 'size-4'} />
      )}
      {amount.toLocaleString('en-US')}
    </button>
  );

  return (
    <div className={`flex flex-col gap-1.5 ${compact ? 'items-end' : 'items-start'}`}>
      <div className={`relative flex items-center ${compact ? '' : 'gap-2'}`}>
        {button(1, 'Vote this mod up', voted.votes.up)}
        {button(-1, 'Vote this mod down', voted.votes.down)}
      </div>
      <p aria-live="polite" className={`max-w-64 text-xs text-fd-error empty:hidden ${compact ? 'text-right' : ''}`}>
        {error}
      </p>
    </div>
  );
}
