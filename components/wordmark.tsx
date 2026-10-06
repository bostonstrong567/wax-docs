export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ''}`}>
      <svg viewBox="0 0 24 24" className="size-5 text-fd-primary" aria-hidden="true">
        <path
          d="M12 2.5 20.2 7.25v9.5L12 21.5l-8.2-4.75v-9.5z"
          fill="currentColor"
          fillOpacity="0.16"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="m7.6 9.4 1.9 5.4L12 10l2.5 4.8 1.9-5.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-[15px] font-semibold tracking-tight">Wax</span>
    </span>
  );
}
