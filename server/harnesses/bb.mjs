/**
 * Harness adapter: bb — the agentic IDE that runs Claude Code and Codex threads.
 *
 * bb keeps its own thread records in a local SQLite database, `~/.bb/bb.db` (WAL mode, so a
 * read-only reader is safe while the app runs; `$BB_DATA_DIR` or `$HARNESS_PLANET_BB_DB` point
 * elsewhere). Every bb thread is backed by a real Claude Code or Codex session, and that session
 * is already on the map through its own adapter. So a bb thread does not add a bot — it
 * *claims* one: it names the provider session it supersedes (`supersedes`), and the scanner
 * merges the two, keeping the transcript-derived facts (size, model, branch, subagents) and
 * taking bb's title, read state and project, and bb as the place a click opens it.
 *
 * The link is `events.provider_thread_id`: the provider's own session id (a Claude Code
 * session UUID, a Codex rollout UUID) recorded on every event bb stored for the thread.
 *
 * Read-only, without exception. bb registers no URL scheme, so opening goes through the bb
 * CLI on PATH (`bb thread open <id>`), launched detached by the server — never from here.
 */
import path from 'node:path'
import os from 'node:os'
import { exists, findExecutable } from '../lib/fsutil.mjs'

const HOME = os.homedir()

async function dbPath() {
  const direct = process.env.HARNESS_PLANET_BB_DB
  if (typeof direct === 'string' && direct) return (await exists(direct)) ? direct : ''
  const dir = process.env.BB_DATA_DIR || path.join(HOME, '.bb')
  const p = path.join(dir, 'bb.db')
  return (await exists(p)) ? p : ''
}

let sqlitePromise
const sqliteApi = () => (sqlitePromise ??= import('node:sqlite').catch(() => null))

const ID = (raw) => `bb:${raw}`

/** bb provider ids that map one-to-one onto another adapter's thread ids. */
const PROVIDER_PREFIX = { 'claude-code': 'claude-code:', codex: 'codex:' }

const QUERY = `
  SELECT t.id, t.provider_id, t.title, t.title_fallback, t.status, t.parent_thread_id,
         t.archived_at, t.last_read_at, t.latest_attention_at, t.created_at, t.updated_at,
         t.model_override, t.reasoning_level_override,
         e.path AS env_path, e.is_worktree, e.branch_name, e.name AS env_name,
         p.name AS project_name,
         (SELECT ps.path FROM project_sources ps
            WHERE ps.project_id = t.project_id AND ps.is_default = 1 LIMIT 1) AS project_path,
         (SELECT ev.provider_thread_id FROM events ev
            WHERE ev.thread_id = t.id AND ev.provider_thread_id IS NOT NULL LIMIT 1) AS provider_session
  FROM threads t
  LEFT JOIN environments e ON e.id = t.environment_id
  LEFT JOIN projects p ON p.id = t.project_id
  WHERE t.deleted_at IS NULL AND t.storage_deleted_at IS NULL AND t.visibility = 'visible'
`

/** The scan runs on a poll; the database only changes when bb writes, so cache on its mtime. */
let cache = { key: '', threads: [] }

async function scanThreads() {
  const file = await dbPath()
  if (!file) return []
  const sqlite = await sqliteApi()
  if (!sqlite?.DatabaseSync) return []

  const fsp = await import('node:fs/promises')
  const stamps = await Promise.all(
    [file, `${file}-wal`].map((f) => fsp.stat(f).then((s) => `${s.mtimeMs}:${s.size}`).catch(() => '-'))
  )
  const key = stamps.join('|')
  if (key === cache.key) return cache.threads

  let db
  let rows = []
  try {
    db = new sqlite.DatabaseSync(file, { readOnly: true })
    rows = db.prepare(QUERY).all()
  } finally {
    db?.close()
  }

  const threads = rows.map((r) => {
    const projectPath = r.project_path || r.env_path || ''
    const cwd = r.env_path || projectPath
    const worktree = r.is_worktree ? r.env_name || path.basename(r.env_path || '') : ''
    const prefix = PROVIDER_PREFIX[r.provider_id]
    const lastRead = Number(r.last_read_at) || 0
    const attention = Number(r.latest_attention_at) || 0
    return {
      id: ID(r.id),
      title: r.title || r.title_fallback || 'Untitled thread',
      preview: r.title_fallback || '',
      project: r.project_name || (projectPath ? path.basename(projectPath) : ''),
      projectPath,
      worktree,
      cwd,
      gitBranch: r.branch_name || '',
      model: r.model_override || '',
      effort: r.reasoning_level_override || '',
      createdAt: Number(r.created_at) || 0,
      lastActivityAt: Number(r.updated_at) || 0,
      lastFocusedAt: lastRead,
      running: r.status === 'active',
      unread: attention > lastRead,
      hasError: r.status === 'error',
      archived: Boolean(r.archived_at),
      source: r.provider_id || '',
      canOpen: true,
      supersedes: prefix && r.provider_session ? [prefix + r.provider_session] : [],
      ref: { threadId: r.id },
    }
  })
  cache = { key, threads }
  return threads
}

async function openThread(ref) {
  const id = typeof ref?.threadId === 'string' ? ref.threadId : ''
  if (!/^thr_[a-z0-9]+$/i.test(id)) return { ok: false, error: 'That is not a bb thread' }
  const bb = await findExecutable('bb')
  if (!bb) return { ok: false, error: 'The bb CLI is not on PATH — open the thread from bb itself' }
  return { ok: true, exec: [bb, 'thread', 'open', id] }
}

function newSession() {
  return { ok: false, error: 'Start new bb threads from bb itself' }
}

async function diagnostic() {
  if (!(await dbPath())) return ''
  if (!(await sqliteApi())?.DatabaseSync) return 'Reading bb needs Node 22.13 or newer (node:sqlite)'
  return ''
}

export default {
  id: 'bb',
  name: 'bb',
  detect: async () => Boolean(await dbPath()),
  diagnostic,
  scanThreads,
  openThread,
  newSession,
}
