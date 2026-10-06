'use client';
import { Check as Tick, CircleX, Copy, LoaderCircle, TriangleAlert, Upload } from 'lucide-react';
import Link from 'next/link';
import { type Dispatch, type FormEvent, type SetStateAction, useEffect, useId, useRef, useState } from 'react';
import { BackToList, BUTTON, day, Fact, type Go, LINK, MAIN_ACTION, Notice } from '@/components/mod-parts';
import { copy } from '@/lib/copy';
import {
  type Answer,
  ApiError,
  type Check,
  getSubmission,
  repoName,
  sentence,
  type Submission,
  submissionId,
  submitMod,
} from '@/lib/market';

// What is typed into the form and what the catalogue last said. Kept by the page, so going back shows it again.
export type Draft = { repo: string; tag: string; busy: boolean; problem: string; answer: Answer | null };
export const NO_DRAFT: Draft = { repo: '', tag: '', busy: false, problem: '', answer: null };

const GITHUB = 'https://github.com/';
const RULES = '/docs/publish-a-mod';
const NO_SUCH = 'The catalogue has no submission with this id.';
const FIELD =
  'h-10 w-full rounded-lg border bg-fd-background px-3 text-sm outline-none placeholder:text-fd-muted-foreground focus-visible:ring-2 focus-visible:ring-fd-ring';

const GROUPS = [
  { level: 'error', title: 'Problems', Icon: CircleX, tone: 'text-fd-error' },
  { level: 'warn', title: 'Warnings', Icon: TriangleAlert, tone: 'text-fd-warning' },
  { level: 'ok', title: 'Passed', Icon: Tick, tone: 'text-fd-success' },
] as const;

const STATUS = {
  pending: {
    title: 'Waiting for review',
    text: 'A person looks at every submission before it is listed. This address shows the answer once there is one.',
  },
  approved: { title: 'Listed', text: 'This version is in the catalogue.' },
  rejected: { title: 'Not accepted', text: 'This version was not listed.' },
};

// The address as the catalogue takes it, or the sentence that says what is wrong with what was typed.
function repositoryOf(typed: string) {
  const wrong = (problem: string) => ({ repo: '', problem });
  const address = typed.trim().replace(/\/+$/, '').replace(/\.git$/i, '');
  if (address === '') return wrong('Type the address of your repository.');
  if (address.slice(0, GITHUB.length).toLowerCase() !== GITHUB) return wrong(`The address must start with ${GITHUB}.`);
  const parts = address.slice(GITHUB.length).split('/');
  if (parts.length < 2 || parts.includes('')) {
    return wrong(`The address needs an owner and a repository name, as in ${GITHUB}owner/name.`);
  }
  if (parts.length > 2 || /[?#]/.test(parts[1])) return wrong('Leave out everything after the repository name.');
  const repo = repoName(parts.join('/'));
  if (!repo) return wrong('The owner or the repository name has a character that GitHub does not allow.');
  return { repo: `${GITHUB}${repo}`, problem: '' };
}

const tagProblem = (tag: string) =>
  tag === '' || /^[^\s~^:?*[\\]{1,100}$/.test(tag) ? '' : 'That is not a tag name. A tag looks like v1.2.0.';

const placeOf = (check: Check) => (check.file && check.line > 0 ? `${check.file}, line ${check.line}` : check.file);

// Problems first, then warnings, then what passed.
function Checks({ checks }: { checks: Check[] }) {
  if (checks.length === 0) return null;
  return (
    <div className="flex flex-col gap-4">
      {GROUPS.map(({ level, title, Icon, tone }) => {
        const found = checks.filter((check) => check.level === level);
        if (found.length === 0) return null;
        return (
          <section key={level} className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">
              {title} <span className="font-normal text-fd-muted-foreground">{found.length}</span>
            </h3>
            <ul className="flex flex-col gap-1.5">
              {found.map((check, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <Icon aria-hidden="true" className={`mt-0.5 size-4 shrink-0 ${tone}`} />
                  <span className="min-w-0 [overflow-wrap:anywhere]">
                    {check.message}{' '}
                    {placeOf(check) ? (
                      <span className="ml-1 font-mono text-xs text-fd-muted-foreground">{placeOf(check)}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <button
      type="button"
      onClick={async () => {
        setCopied(await copy(text));
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 1600);
      }}
      className={`inline-flex shrink-0 items-center gap-1.5 ${BUTTON}`}
    >
      {copied ? <Tick aria-hidden="true" className="size-4 text-fd-primary" /> : <Copy aria-hidden="true" className="size-4" />}
      <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
    </button>
  );
}

function Commit({ submission }: { submission: Submission }) {
  const short = submission.commit.slice(0, 7);
  if (!submission.repo || !/^[0-9a-f]{7,64}$/i.test(submission.commit)) return <span className="font-mono">{short}</span>;
  return (
    <a
      href={`${GITHUB}${submission.repo}/commit/${submission.commit}`}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className={`font-mono ${LINK}`}
    >
      {short}
    </a>
  );
}

function Accepted(props: { submission: Submission; status: (id: string) => Go; onAgain: () => void }) {
  const { submission } = props;
  const go = props.status(submission.id);
  const address = typeof window === 'undefined' ? go.href : new URL(go.href, window.location.href).href;
  return (
    <section className="flex flex-col gap-5 rounded-xl border bg-fd-card p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium">{STATUS.pending.title}</h2>
        <p className="text-sm text-fd-muted-foreground">
          Your mod was checked and is waiting for review. It is listed after a person has looked at it.
        </p>
      </div>
      <dl className="flex flex-wrap gap-x-8 gap-y-3">
        <Fact label="Mod">{submission.mod.name || submission.mod.id}</Fact>
        <Fact label="Version">
          <span className="font-mono">{submission.mod.version}</span>
        </Fact>
        <Fact label="Commit">
          <Commit submission={submission} />
        </Fact>
      </dl>
      <div className="flex flex-col gap-2">
        <p className="text-sm">Keep this address. It shows what was decided.</p>
        <div className="flex flex-wrap items-center gap-3">
          <a {...go} className={`min-w-0 font-mono text-sm [overflow-wrap:anywhere] ${LINK}`}>
            {address}
          </a>
          <CopyButton text={address} />
        </div>
      </div>
      <Checks checks={submission.checks} />
      <button type="button" onClick={props.onAgain} className={`self-start ${BUTTON}`}>
        Submit another mod
      </button>
    </section>
  );
}

export function SubmitView(props: {
  draft: Draft;
  setDraft: Dispatch<SetStateAction<Draft>>;
  list: Go;
  status: (id: string) => Go;
  categories: string[];
}) {
  const { draft, setDraft } = props;
  const repoField = useId();
  const tagField = useId();
  const problemText = useId();
  const accepted = draft.answer && 'submission' in draft.answer ? draft.answer.submission : null;
  const refused = draft.answer && 'error' in draft.answer ? draft.answer : null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (draft.busy) return;
    const { repo, problem } = repositoryOf(draft.repo);
    const tag = draft.tag.trim();
    const wrong = problem || tagProblem(tag);
    if (wrong) {
      setDraft({ ...draft, problem: wrong, answer: null });
      return;
    }
    setDraft({ ...draft, busy: true, problem: '', answer: null });
    const answer = await submitMod(repo, tag);
    setDraft((now) => ({ ...now, busy: false, answer }));
  }

  return (
    <article className="flex flex-col gap-8">
      <BackToList list={props.list} />
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Submit a mod</h1>
        <p className="max-w-2xl text-fd-muted-foreground">
          Give the address of a public GitHub repository that holds your mod. It is checked at once, and it is listed
          after a person has looked at it.
        </p>
        <p className="max-w-2xl text-sm text-fd-muted-foreground">
          <Link href={RULES} className={LINK}>
            Publish a mod
          </Link>{' '}
          has the layout of the repository, the rules and a checklist.
        </p>
        {props.categories.length > 0 ? (
          <p className="max-w-2xl text-sm text-fd-muted-foreground">
            The categories a mod can be in: {props.categories.join(', ')}.
          </p>
        ) : null}
      </header>

      {accepted ? (
        <Accepted submission={accepted} status={props.status} onAgain={() => setDraft(NO_DRAFT)} />
      ) : (
        <form onSubmit={submit} noValidate className="flex max-w-2xl flex-col gap-4 rounded-xl border bg-fd-card p-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={repoField} className="text-sm font-medium">
              Repository address
            </label>
            <input
              id={repoField}
              type="text"
              inputMode="url"
              value={draft.repo}
              onChange={(event) => setDraft({ ...draft, repo: event.target.value, problem: '' })}
              placeholder={`${GITHUB}owner/name`}
              maxLength={300}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              aria-invalid={draft.problem !== ''}
              aria-describedby={draft.problem ? problemText : undefined}
              className={FIELD}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={tagField} className="text-sm font-medium">
              Tag <span className="font-normal text-fd-muted-foreground">(optional)</span>
            </label>
            <input
              id={tagField}
              type="text"
              value={draft.tag}
              onChange={(event) => setDraft({ ...draft, tag: event.target.value, problem: '' })}
              placeholder="v1.2.0"
              maxLength={100}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className={`sm:max-w-60 ${FIELD}`}
            />
            <p className="text-xs text-fd-muted-foreground">
              Leave it empty to take the latest release. Without a release, the newest commit is taken.
            </p>
          </div>
          {draft.problem ? (
            <p id={problemText} role="alert" className="text-sm text-fd-error">
              {draft.problem}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={draft.busy} aria-busy={draft.busy} className={`${MAIN_ACTION} px-3.5 py-2`}>
              {draft.busy ? (
                <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
              ) : (
                <Upload aria-hidden="true" className="size-4" />
              )}
              {draft.busy ? 'Checking' : 'Submit'}
            </button>
            {draft.busy ? (
              <span className="text-sm text-fd-muted-foreground">
                The catalogue is fetching the repository and checking it.
              </span>
            ) : null}
          </div>
        </form>
      )}

      <div aria-live="polite" className="empty:hidden">
        {refused ? (
          <section className="flex max-w-2xl flex-col gap-4 rounded-xl border bg-fd-card p-5">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-medium">Not submitted</h2>
              <p>{refused.error}</p>
              {refused.checks.length > 0 ? (
                <p className="text-sm text-fd-muted-foreground">
                  Fix the problems in the repository, then submit again.
                </p>
              ) : null}
            </div>
            <Checks checks={refused.checks} />
          </section>
        ) : null}
      </div>
    </article>
  );
}

export function SubmissionView(props: { id: string; list: Go; mod: (id: string) => Go }) {
  const id = submissionId(props.id);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<{ id: string; data: Submission | null; error: string; missing: boolean }>({
    id: '',
    data: null,
    error: '',
    missing: false,
  });

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    getSubmission(id, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setLoaded({ id, data, error: '', missing: false });
      },
      (error) => {
        if (controller.signal.aborted) return;
        const missing = error instanceof ApiError && error.status === 404;
        setLoaded({ id, data: null, error: missing ? NO_SUCH : sentence(error), missing });
      },
    );
    return () => controller.abort();
  }, [id, attempt]);

  const current = id && loaded.id === id ? loaded : null;
  const error = id ? (current?.error ?? '') : NO_SUCH;
  const submission = current?.data ?? null;
  const retry = () => {
    setLoaded({ id: '', data: null, error: '', missing: false });
    setAttempt((n) => n + 1);
  };

  return (
    <article className="flex flex-col gap-8">
      <BackToList list={props.list} />
      {error ? (
        <Notice text={error} action="Try again" onAction={!id || current?.missing ? undefined : retry} />
      ) : !submission ? (
        <p className="text-sm text-fd-muted-foreground">Loading the submission.</p>
      ) : (
        <>
          <header className="flex flex-col gap-4">
            <p className="-mb-2 text-sm text-fd-muted-foreground">Submission</p>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                {submission.mod.name || submission.mod.id || submission.repo}
              </h1>
              <span className="font-mono text-sm text-fd-muted-foreground">{submission.mod.version}</span>
            </div>
            {submission.mod.summary ? (
              <p className="max-w-2xl text-fd-muted-foreground [overflow-wrap:anywhere]">{submission.mod.summary}</p>
            ) : null}
            <dl className="flex flex-wrap gap-x-8 gap-y-3">
              <Fact label="Status">{STATUS[submission.status].title}</Fact>
              {submission.repo ? (
                <Fact label="Repository">
                  <a href={`${GITHUB}${submission.repo}`} target="_blank" rel="noopener noreferrer nofollow" className={LINK}>
                    {submission.repo}
                  </a>
                </Fact>
              ) : null}
              {submission.commit ? (
                <Fact label="Commit">
                  <Commit submission={submission} />
                </Fact>
              ) : null}
              {submission.ref ? (
                <Fact label="Tag">
                  <span className="font-mono">{submission.ref}</span>
                </Fact>
              ) : null}
              {day(submission.created_at) ? <Fact label="Submitted">{day(submission.created_at)}</Fact> : null}
              {submission.mod.author ? <Fact label="Author">{submission.mod.author}</Fact> : null}
              {submission.mod.category ? <Fact label="Category">{submission.mod.category}</Fact> : null}
              <Fact label="Pictures">{submission.pictures}</Fact>
              {submission.mod.id ? (
                <Fact label="Id">
                  <span className="font-mono">{submission.mod.id}</span>
                </Fact>
              ) : null}
              {submission.mod.needs_wax ? <Fact label="Needs">Wax {submission.mod.needs_wax}</Fact> : null}
            </dl>
          </header>

          <section className="flex flex-col items-start gap-2 rounded-xl border bg-fd-card p-5">
            <h2 className="text-lg font-medium">{STATUS[submission.status].title}</h2>
            <p className="text-sm text-fd-muted-foreground">{STATUS[submission.status].text}</p>
            {submission.status === 'rejected' && submission.note ? (
              <p className="max-w-3xl whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">
                <span className="text-fd-muted-foreground">The reviewer wrote: </span>
                {submission.note}
              </p>
            ) : null}
            {submission.status === 'rejected' ? (
              <p className="text-sm text-fd-muted-foreground">
                <Link href={RULES} className={LINK}>
                  Publish a mod
                </Link>{' '}
                says what a mod needs to be listed.
              </p>
            ) : null}
            {submission.status === 'approved' && submission.mod.id ? (
              <a {...props.mod(submission.mod.id)} className={`text-sm ${LINK}`}>
                Open {submission.mod.name || submission.mod.id} in the catalogue
              </a>
            ) : null}
          </section>

          {submission.checks.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-medium">Checks</h2>
              <Checks checks={submission.checks} />
            </section>
          ) : null}
        </>
      )}
    </article>
  );
}
