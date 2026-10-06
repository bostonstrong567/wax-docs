import { marketApi } from '@/lib/shared';

export const UNREACHABLE = 'The mod catalogue cannot be reached right now.';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function getJson<T>(path: string, signal: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${marketApi}${path}`, { signal, headers: { Accept: 'application/json' } });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new ApiError(UNREACHABLE, 0);
  }
  const body: unknown = await response.json().catch(() => null);
  if (body === null || typeof body !== 'object') throw new ApiError(UNREACHABLE, response.status);
  if (!response.ok) {
    const said = (body as { error?: unknown }).error;
    throw new ApiError(response.status < 500 && typeof said === 'string' ? said : UNREACHABLE, response.status);
  }
  return body as T;
}

export const sentence = (error: unknown) => (error instanceof ApiError ? error.message : UNREACHABLE);

// A path the catalogue gives, as a full address on the catalogue's host.
export function onMarket(path: unknown) {
  if (typeof path !== 'string' || !/^\/[^/\\]/.test(path)) return '';
  return `${new URL(marketApi).origin}${path}`;
}

// "owner/name" of a GitHub repository, from that or from its address. Empty when it is neither.
export function repoName(value: unknown) {
  if (typeof value !== 'string') return '';
  const name = value.trim().replace(/^https:\/\/github\.com\//i, '');
  return /^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9._-]{1,100}$/.test(name) ? name : '';
}

export type Check = { level: 'error' | 'warn' | 'ok'; code: string; message: string; file: string; line: number };
export type Submission = {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  repo: string;
  ref: string;
  commit: string;
  mod: { id: string; name: string; version: string; author: string; category: string; summary: string; needs_wax: string };
  checks: Check[];
  pictures: number;
  created_at: string;
  note: string;
};
export type Answer = { submission: Submission } | { error: string; checks: Check[] };

const LEVELS = ['error', 'warn', 'ok'] as const;
const STATUSES = ['pending', 'approved', 'rejected'] as const;
// The answers whose sentence comes from the catalogue and is shown as it is.
const SAID = [400, 409, 413, 422, 429, 502, 503];

const text = (value: unknown) => (typeof value === 'string' ? value : '');
const fields = (value: unknown) => (value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {});

function checksOf(value: unknown): Check[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const given = fields(entry);
    const level = LEVELS.find((known) => known === given.level);
    const message = text(given.message);
    if (!level || !message) return [];
    const line = typeof given.line === 'number' && Number.isInteger(given.line) && given.line > 0 ? given.line : 0;
    return [{ level, code: text(given.code), message, file: text(given.file), line }];
  });
}

export const submissionId = (value: string) => (/^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : '');

function submissionOf(value: unknown): Submission | null {
  const given = fields(value);
  const id = submissionId(text(given.id));
  if (!id) return null;
  const mod = fields(given.mod);
  return {
    id,
    status: STATUSES.find((known) => known === given.status) ?? 'pending',
    repo: repoName(given.repo),
    ref: text(given.ref),
    commit: text(given.commit),
    mod: {
      id: text(mod.id),
      name: text(mod.name),
      version: text(mod.version),
      author: text(mod.author),
      category: text(mod.category),
      summary: text(mod.summary),
      needs_wax: text(mod.needs_wax),
    },
    checks: checksOf(given.checks),
    pictures: typeof given.pictures === 'number' && given.pictures > 0 ? Math.floor(given.pictures) : 0,
    created_at: text(given.created_at),
    note: text(given.note),
  };
}

// Sends JSON and gives back the answer's status and fields. Null when the catalogue cannot be reached.
async function postJson(path: string, sent: unknown) {
  try {
    const response = await fetch(`${marketApi}${path}`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(sent),
    });
    return { status: response.status, ok: response.ok, body: fields(await response.json().catch(() => null)) };
  } catch {
    return null;
  }
}

// Never throws: what cannot be sent or read comes back as the sentence to show.
export async function submitMod(repo: string, ref: string): Promise<Answer> {
  const answer = await postJson('/submissions', ref ? { repo, ref } : { repo });
  const submission = answer?.ok ? submissionOf(answer.body.submission) : null;
  if (submission) return { submission };
  if (!answer || !SAID.includes(answer.status)) return { error: UNREACHABLE, checks: [] };
  const checks = answer.status === 422 ? checksOf(answer.body.checks) : [];
  const said = text(answer.body.error) || (checks.length > 0 ? 'The mod did not pass the checks.' : UNREACHABLE);
  return { error: said, checks };
}

export async function getSubmission(id: string, signal: AbortSignal): Promise<Submission> {
  const body = await getJson<{ submission?: unknown }>(`/submissions/${encodeURIComponent(id)}`, signal);
  const submission = submissionOf(body.submission);
  if (!submission) throw new ApiError(UNREACHABLE, 200);
  return submission;
}

export type Votes = { up: number; down: number };
export type Vote = 1 | -1 | 0;
export type Voted = { votes: Votes; mine: Vote };

// Null when the catalogue sent no votes, as an older one does.
export function votesOf(value: unknown): Votes | null {
  const { up, down } = fields(value);
  if (typeof up !== 'number' || typeof down !== 'number' || !(up >= 0) || !(down >= 0)) return null;
  return { up: Math.floor(up), down: Math.floor(down) };
}

function votedOf(value: unknown): Voted | null {
  const given = fields(value);
  const votes = votesOf(given.votes);
  return votes ? { votes, mine: given.mine === 1 || given.mine === -1 ? given.mine : 0 } : null;
}

// The votes of a mod and the visitor's own. Null when the catalogue has none or cannot be reached.
export async function getVote(id: string, signal: AbortSignal): Promise<Voted | null> {
  try {
    return votedOf(await getJson(`/mods/${encodeURIComponent(id)}/vote`, signal));
  } catch {
    return null;
  }
}

// 0 takes the vote back. An older catalogue answers 404, which reads as not reachable.
export async function sendVote(id: string, vote: Vote): Promise<Voted | { error: string }> {
  const answer = await postJson(`/mods/${encodeURIComponent(id)}/vote`, { vote });
  const voted = answer?.ok ? votedOf(answer.body) : null;
  if (voted) return voted;
  const said = answer && answer.status >= 400 && answer.status < 500 && answer.status !== 404 ? text(answer.body.error) : '';
  return { error: said || UNREACHABLE };
}
