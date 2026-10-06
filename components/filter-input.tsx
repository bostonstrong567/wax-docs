'use client';
import { Search, X } from 'lucide-react';

export function FilterInput(props: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
}) {
  return (
    <div className="relative min-w-0 flex-1">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fd-muted-foreground"
      />
      <input
        type="text"
        inputMode="search"
        enterKeyHint="search"
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        aria-label={props.label}
        placeholder={props.placeholder}
        maxLength={200}
        autoComplete="off"
        spellCheck={false}
        className="h-10 w-full rounded-lg border bg-fd-card pl-9 pr-9 text-sm outline-none placeholder:text-fd-muted-foreground focus-visible:ring-2 focus-visible:ring-fd-ring"
      />
      {props.value !== '' ? (
        <button
          type="button"
          onClick={() => props.onChange('')}
          aria-label="Clear the search"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-fd-muted-foreground transition-colors hover:text-fd-foreground"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
