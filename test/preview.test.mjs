/**
 * The demo colony behind "Just look around".
 *
 * Three things here are worth holding still. One is the shape of the day it shows: mostly
 * quiet, with a handful of live work and somebody with a hand up — a preview where everybody
 * is busy is a preview of a screensaver, and one with nobody waiting on you is a preview of
 * the wrong product. The second is that two astronauts walk out of the ship on arrival and
 * then stay put, because the entrance is the moment the map explains itself and a second
 * showing of it is a bug. The third is that none of it can pass for somebody's real work:
 * every id is stamped, and nothing claims to be openable.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { previewSeen, previewThreads } from '../src/game/preview.js'

/**
 * `statusFor` from `src/game/colony.js`, which cannot be imported here — it reaches three.js and
 * the world modules, and those want a browser. Copied rather than skipped, because what these
 * tests are actually about is the statuses the roster comes out as; asserting the flags instead
 * would only check that the table says what the table says.
 */
const STALE_MS = 3 * 24 * 60 * 60 * 1000
function statusFor(thread, now) {
  if (thread.hasError) return 'blocked'
  if (thread.running) return 'working'
  if (thread.prState === 'MERGED') return 'celebrating'
  if (thread.unread) return 'waiting'
  if (now - thread.lastActivityAt > STALE_MS) return 'sleeping'
  return 'idle'
}

/** The three the HUD counts as live work. `celebrating` is finished and `idle` never started. */
const ACTIVE = ['working', 'waiting', 'blocked']

const NOW = Date.UTC(2026, 0, 14, 9, 30)
const tally = (now = NOW) => {
  const counts = {}
  for (const thread of previewThreads(now)) {
    const status = statusFor(thread, now)
    counts[status] = (counts[status] ?? 0) + 1
  }
  return counts
}

test('the demo is several different repos, not one repo several times', () => {
  const projects = new Set(previewThreads(NOW).map((t) => t.project))
  assert.ok(projects.size >= 4, `only ${projects.size} repos — a real machine has more than that`)
})

test('the whole roster, status by status — the numbers somebody chose, not the ones that drifted', () => {
  assert.deepEqual(tally(), { working: 3, waiting: 3, blocked: 2, celebrating: 2, idle: 11 })
})

/**
 * The one number the demo is really tuned on. A checkout folder at any given minute is mostly
 * finished and parked work, and a colony where everyone is doing something reads as a toy —
 * so the point of the roster is that most of it is standing still.
 */
test('about two in five are doing anything, and the rest are quiet', () => {
  const counts = tally()
  const total = Object.values(counts).reduce((n, c) => n + c, 0)
  const active = ACTIVE.reduce((n, key) => n + (counts[key] ?? 0), 0)
  assert.equal(total, 21)
  assert.equal(active, 8)
  const share = active / total
  assert.ok(share > 0.33 && share < 0.45, `${Math.round(share * 100)}% active — the demo is meant to read calm`)
})

test('somebody is always waiting on you, which is what the raised hand is for', () => {
  assert.ok((tally().waiting ?? 0) >= 3, 'a demo with nobody asking for you demos the wrong thing')
})

test('being calm never costs the two states worth showing', () => {
  const counts = tally()
  assert.ok(counts.waiting > 0, 'the `?` badge is the most distinctive thing on the map')
  assert.ok(counts.blocked > 0, 'and a stuck astronaut is the second')
})

test('every state the colony can draw is on the map at once', () => {
  const counts = tally()
  for (const status of ['working', 'waiting', 'blocked', 'celebrating', 'idle']) {
    assert.ok(counts[status] > 0, `nothing is ${status}`)
  }
})

test('nothing in the demo is dormant, because a dormant repo folds off the map entirely', () => {
  assert.equal(tally().sleeping ?? 0, 0)
  // And still true an hour later: the roster is timed against `now`, not against a fixed date.
  assert.equal(tally(NOW + 60 * 60 * 1000).sleeping ?? 0, 0)
})

/**
 * A shipped thread sits out of this: it is finished, and how long ago it was merged says
 * nothing either way. Only the two claims that can contradict each other on screen are pinned.
 */
test('a quiet thread last moved hours ago, and a busy one minutes — or the card argues with the pose', () => {
  for (const thread of previewThreads(NOW)) {
    const status = statusFor(thread, NOW)
    const minutes = (NOW - thread.lastActivityAt) / 60000
    if (status === 'idle') assert.ok(minutes >= 60, `${thread.title} is idle but moved ${Math.round(minutes)}m ago`)
    if (ACTIVE.includes(status)) {
      assert.ok(minutes <= 120, `${thread.title} is live but has not moved for ${Math.round(minutes)}m`)
    }
  }
})

// ── the entrance ────────────────────────────────────────────────────────────────────────

test('two astronauts are still outside the colony memory, so two walk down the ramp', () => {
  const threads = previewThreads(NOW)
  const seen = previewSeen(threads)
  const arriving = threads.filter((t) => !(t.id in seen))
  assert.equal(arriving.length, 2, 'one is not an arrival and three is a queue at a one-astronaut door')
})

test('the two arriving are the two that just moved, so the card agrees with the walk', () => {
  const threads = previewThreads(NOW)
  const seen = previewSeen(threads)
  const arriving = threads.filter((t) => !(t.id in seen))
  assert.deepEqual(
    arriving.map((t) => t.id),
    threads.slice(0, 2).map((t) => t.id)
  )
})

test('no two threads share a last-activity, so "the newest two" is one answer', () => {
  const times = previewThreads(NOW).map((t) => t.lastActivityAt)
  assert.equal(new Set(times).size, times.length, 'a tie makes the arriving pair depend on the sort')
})

test('everything already met is recorded at the time it last moved', () => {
  const threads = previewThreads(NOW)
  const seen = previewSeen(threads)
  for (const thread of threads.slice(2)) assert.equal(seen[thread.id], thread.lastActivityAt)
})

/**
 * The bookkeeping from `applyThreads` in `src/main.js` — copied for the same reason `statusFor`
 * is, and asserted because the entrance is the one thing in the demo that must happen once. The
 * page reads which threads it has met *before* recording this pass, so a thread walks out on
 * the poll it appears on and is simply standing there on every poll after.
 */
function entrances(seen, threads) {
  const known = new Set(Object.keys(seen))
  for (const thread of threads) if (!(thread.id in seen)) seen[thread.id] = Date.now()
  return threads.filter((t) => !known.has(t.id)).length
}

test('the arrival happens once — a poll every fifteen seconds must not replay it', () => {
  const threads = previewThreads(NOW)
  const seen = previewSeen(threads)
  assert.equal(entrances(seen, threads), 2, 'the pass that draws the demo is the one that stages the entrance')
  assert.equal(entrances(seen, threads), 0, 'and the next poll finds them already outside')
  assert.equal(entrances(seen, threads), 0)
})

// ── nothing here is anybody's real work ─────────────────────────────────────────────────

test('every id is stamped preview, so one in a colony file is unmistakable', () => {
  for (const thread of previewThreads(NOW)) {
    assert.ok(thread.id.startsWith('preview:'), `${thread.id} could be mistaken for a real thread`)
  }
})

test('ids are unique — the colony keys its archive list and its layout on them', () => {
  const threads = previewThreads(NOW)
  assert.equal(new Set(threads.map((t) => t.id)).size, threads.length)
})

test('nothing in the demo claims to be openable', () => {
  for (const thread of previewThreads(NOW)) {
    assert.equal(thread.canOpen, false, thread.id)
    assert.equal(thread.openUrl, '', 'an open url is a deep link waiting to be followed')
    assert.ok(thread.openHint, 'a greyed-out button has to say why')
  }
})

test('the roster arrives newest first, the way a real scan does', () => {
  const times = previewThreads(NOW).map((t) => t.lastActivityAt)
  assert.deepEqual(times, [...times].sort((a, b) => b - a))
})
