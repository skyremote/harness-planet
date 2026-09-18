/**
 * The demo colony behind "Just look around".
 *
 * A hosted world with no folder granted is an empty world, and an empty world is a poor
 * argument for a game about watching a colony work. So the skip button lands on a stand-in
 * machine instead: the spread of repos a working checkout folder actually has, and the mix of
 * states a working day actually has.
 *
 * Which is mostly quiet. Eight of these twenty-one threads are doing anything — the rest are
 * finished or parked, because that is what a checkout folder looks like at any given minute,
 * and a colony where everybody is busy reads as a screensaver rather than as a readout. What
 * the eight buy is the handful that matters: somebody working, somebody stuck, and above all
 * somebody with a hand up, since one astronaut stopping to ask you something is the thing the
 * whole colony exists to make visible.
 *
 * Invented rather than sampled, because at this point there is nothing to sample. Kept free of
 * three.js and the DOM so it stays readable and can be checked under bare node: the property
 * that matters — that none of this can be mistaken for somebody's own work — is a property of
 * the data, and nothing about the renderer can establish it.
 */

/**
 * Every preview id carries this. Thread ids are otherwise prefixed with the harness that owns
 * them (see DECISIONS.md), and breaking that here is the point: `preview` is not a harness and
 * will never be one, so an id of this shape appearing in a colony file is a bug anybody can
 * recognise on sight rather than a plausible-looking id nobody thinks to question.
 */
const ID_PREFIX = 'preview'

const MINUTE = 60_000
/** Roughly how long ago a thread started, relative to its last activity. Only the card reads it. */
const SESSION_MINUTES = 180

/**
 * How many of the roster the colony should *not* already know about when the demo opens.
 *
 * A thread the colony has never met walks down the ship's ramp and off to its plot, and that
 * walk is the one moment the map explains itself: this is a thread, it just started, here is
 * where it went. Nineteen of them doing it at once is the scrum the `seen` record exists to
 * prevent — but none of them doing it is a still life, and the first thing anyone is shown
 * should be the thing moving. Two is enough to read as an arrival and few enough that they do
 * not queue at a door that is one astronaut wide.
 */
const ARRIVALS = 2

/**
 * The one flag each behaviour turns on, exactly as a harness reports it.
 *
 * `statusFor` reads these in a strict precedence, so one flag per thread is all it takes, and
 * naming the behaviour beside the flag is what keeps this table honest if that precedence ever
 * moves — a row that stops meaning what it says is the only way this file can go quietly wrong.
 */
const FLAGS = {
  working: { running: true },
  waiting: { unread: true },
  blocked: { hasError: true },
  shipped: { prState: 'MERGED' },
  idle: {},
}

/**
 * The machine being stood in for: six repos across three harnesses, which is roughly what a
 * developer's checkout folder looks like and deliberately not six versions of one app.
 *
 * `ago` is minutes since a thread last moved, and every one of them is well inside the three
 * days after which the colony calls a thread dormant — a dormant repo folds off the map
 * wholesale, and a demo whose best case is an empty field has failed at its only job. It also
 * has to agree with `state`: a thread that moved ninety seconds ago and is idle reads as a
 * bug, so the quiet rows are hours back and the busy ones are minutes. No two rows share an
 * `ago`, which is what makes "the newest two" — the pair that walks out of the ship — one
 * answer rather than whichever way a sort happened to break a tie. `kb` is the transcript
 * size, which is what decides how finished each building looks.
 */
const WORKSPACE = [
  {
    project: 'storefront',
    harness: 'claude-code',
    harnessName: 'Claude Code',
    path: '~/code/storefront',
    threads: [
      { title: 'Add Apple Pay to the express checkout', state: 'working', ago: 1, kb: 720, branch: 'apple-pay' },
      { title: 'Move the product grid to server components', state: 'idle', ago: 140, kb: 1480, branch: 'rsc' },
      { title: 'Search box loses focus on iOS Safari', state: 'waiting', ago: 14, kb: 260, branch: 'ios-search' },
      { title: 'Cart total is a cent out on multi-currency orders', state: 'blocked', ago: 6, kb: 94 },
      { title: 'Black Friday banner and countdown', state: 'shipped', ago: 95, kb: 540, branch: 'bf-banner' },
      { title: 'Tidy up the Sass variables nobody uses', state: 'idle', ago: 320, kb: 38 },
    ],
  },
  {
    project: 'billing-api',
    harness: 'codex',
    harnessName: 'Codex',
    path: '~/code/billing-api',
    threads: [
      { title: 'Retry failed Stripe webhooks with backoff', state: 'working', ago: 2, kb: 980, branch: 'retry' },
      { title: 'Invoice PDFs render blank on annual plans', state: 'waiting', ago: 23, kb: 410 },
      { title: 'Idempotency keys on the charge endpoint', state: 'idle', ago: 270, kb: 150, branch: 'keys' },
      { title: 'Split the tax table into its own migration', state: 'shipped', ago: 640, kb: 320 },
    ],
  },
  {
    project: 'atlas-cli',
    harness: 'claude-code',
    harnessName: 'Claude Code',
    path: '~/code/atlas-cli',
    threads: [
      { title: 'Port the config loader from JSON to TOML', state: 'idle', ago: 260, kb: 610, branch: 'toml' },
      { title: 'Cannot find module after the ESM switch', state: 'blocked', ago: 40, kb: 72, branch: 'esm' },
      { title: 'Write the man page for atlas sync', state: 'idle', ago: 1500, kb: 46 },
    ],
  },
  {
    project: 'pricing-site',
    harness: 'cursor',
    harnessName: 'Cursor',
    path: '~/work/pricing-site',
    threads: [
      { title: 'Annual and monthly toggle with a discount badge', state: 'working', ago: 4, kb: 390 },
      { title: 'Rewrite the enterprise tier copy', state: 'idle', ago: 380, kb: 120, worktree: 'copy' },
      { title: 'Lighthouse dropped to 61 after the font swap', state: 'idle', ago: 810, kb: 200 },
    ],
  },
  {
    project: 'telemetry-worker',
    harness: 'codex',
    harnessName: 'Codex',
    path: '~/code/telemetry-worker',
    threads: [
      { title: 'Session ids going missing from the mobile SDK', state: 'waiting', ago: 8, kb: 480 },
      { title: 'Batch the KV writes on the hot path', state: 'idle', ago: 430, kb: 1900, branch: 'kv-batching' },
      { title: 'Dead-letter queue for malformed events', state: 'idle', ago: 1100, kb: 88 },
    ],
  },
  {
    project: 'dotfiles',
    harness: 'claude-code',
    harnessName: 'Claude Code',
    path: '~/dotfiles',
    threads: [
      { title: 'Get zsh starting in under 200ms', state: 'idle', ago: 190, kb: 64 },
      { title: 'Move the nvim config over to lua', state: 'idle', ago: 700, kb: 2400 },
    ],
  },
]

/**
 * The stand-in roster, timed against `now` so nothing in it is ever stale enough to fold away.
 *
 * Sorted newest first like every real scan, so the colony lays it out the same way it would lay
 * out the machine this is pretending to be.
 */
export function previewThreads(now = Date.now()) {
  const threads = []
  for (const repo of WORKSPACE) {
    repo.threads.forEach((row, index) => {
      const worktree = row.worktree || ''
      threads.push({
        id: `${ID_PREFIX}:${repo.project}-${index}`,
        harness: repo.harness,
        harnessName: repo.harnessName,
        title: row.title,
        preview: '',
        project: repo.project,
        projectPath: repo.path,
        worktree,
        cwd: worktree ? `${repo.path}/.worktrees/${worktree}` : repo.path,
        gitBranch: row.branch || 'main',
        model: '',
        effort: '',
        createdAt: now - (row.ago + SESSION_MINUTES) * MINUTE,
        lastActivityAt: now - row.ago * MINUTE,
        lastFocusedAt: 0,
        running: false,
        unread: false,
        hasError: false,
        starred: false,
        routine: '',
        prState: '',
        archived: false,
        sizeBytes: row.kb * 1024,
        source: ID_PREFIX,
        // There is no session behind any of this, so the answer to "can this be opened" is no
        // and is given here rather than discovered. That greys the Open button out, which is
        // the honest failure; the alternative is sending the browser at a `claude://` link for
        // a thread that does not exist and letting the operating system shrug at somebody.
        canOpen: false,
        openUrl: '',
        openHint: 'Nothing to open — this is a demo colony, not your computer',
        ref: null,
        ...FLAGS[row.state],
      })
    })
  }
  return threads.sort((a, b) => b.lastActivityAt - a.lastActivityAt)
}

/**
 * The `seen` record the demo starts on: every thread here except the newest `ARRIVALS`.
 *
 * `seen` is the colony's memory of which threads it has already met, and the page keys the
 * ship entrance off it — so writing it is how the demo decides who is already at work and who
 * is still walking. The newest few are the ones left out, because they are the ones whose
 * timestamps already say they only just moved; picking any others would put an astronaut on
 * the ramp whose own card claims it has been going for five hours.
 *
 * The roster arrives sorted newest first and no two rows share an `ago`, so "the newest two"
 * is a fact about the data rather than about how the sort broke a tie.
 *
 * Only the entrance is at stake. The page records these two the moment it draws them, which is
 * what keeps them from walking out of the ship again on the next poll.
 */
export function previewSeen(threads) {
  return Object.fromEntries(threads.slice(ARRIVALS).map((t) => [t.id, t.lastActivityAt]))
}
