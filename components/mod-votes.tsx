'use client';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getVote, sendVote, type Vote, type Voted, type Votes } from '@/lib/market';

const PRESSED = 'border-fd-primary bg-fd-primary/10 text-fd-primary';
const NOT_PRESSED = 'bg-fd-card text-fd-muted-foreground hover:bg-fd-accent hover:text-fd-accent-foreground';

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

// Up minus down on a card. Nothing for a mod nobody has voted on.
export function Score({ votes }: { votes: Votes | null }) {
  if (!votes || votes.up + votes.down === 0) return null;
  return (
    <span className="inline-flex items-center gap-1">
      <ThumbsUp aria-hidden="true" className="size-3.5" />
      <span className="sr-only">Score</span>
      {(votes.up - votes.down).toLocaleString('en-US')}
    </span>
  );
}

export function VoteButtons({ id, first }: { id: string; first: Votes }) {
  const [voted, setVoted] = useState<Voted>({ votes: first, mine: 0 });
  const [error, setError] = useState('');
  const pressed = useRef(false);
  const busy = useRef(false);

  // The visitor's own vote. An answer that comes after a press is dropped.
  useEffect(() => {
    const controller = new AbortController();
    getVote(id, controller.signal).then((answer) => {
      if (answer && !controller.signal.aborted && !pressed.current) setVoted(answer);
    });
    return () => controller.abort();
  }, [id]);

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
    }
  }

  const button = (wanted: 1 | -1, label: string, amount: number) => (
    <button
      type="button"
      aria-label={label}
      aria-pressed={voted.mine === wanted}
      onClick={() => press(wanted)}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm tabular-nums transition-colors outline-none focus-visible:ring-2 focus-visible:ring-fd-ring ${
        voted.mine === wanted ? PRESSED : NOT_PRESSED
      }`}
    >
      {wanted === 1 ? <ThumbsUp aria-hidden="true" className="size-4" /> : <ThumbsDown aria-hidden="true" className="size-4" />}
      {amount.toLocaleString('en-US')}
    </button>
  );

  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="flex items-center gap-2">
        {button(1, 'Vote this mod up', voted.votes.up)}
        {button(-1, 'Vote this mod down', voted.votes.down)}
      </div>
      <p aria-live="polite" className="max-w-64 text-xs text-fd-error empty:hidden">
        {error}
      </p>
    </div>
  );
}
