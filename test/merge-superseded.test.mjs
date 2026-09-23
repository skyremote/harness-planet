import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeSuperseded } from '../server/scan.mjs'

test('a wrapping harness claims the wrapped thread instead of adding a second bot', () => {
  const merged = mergeSuperseded([
    { id: 'claude-code:abc', title: 'raw', sizeBytes: 900, model: 'opus', running: true, harness: 'claude-code' },
    { id: 'bb:thr_1', title: 'From bb', sizeBytes: 0, model: '', running: false, unread: true, harness: 'bb', supersedes: ['claude-code:abc'] },
    { id: 'codex:xyz', title: 'alone', harness: 'codex' },
  ])
  assert.equal(merged.length, 2)
  const bb = merged.find((t) => t.id === 'bb:thr_1')
  assert.equal(bb.title, 'From bb')
  assert.equal(bb.sizeBytes, 900)
  assert.equal(bb.model, 'opus')
  assert.equal(bb.running, true)
  assert.equal(bb.unread, true)
  assert.equal(bb.harness, 'bb')
  assert.equal('supersedes' in bb, false)
})

test('a claim on a thread nobody else reported leaves the claimant as it is', () => {
  const merged = mergeSuperseded([{ id: 'bb:thr_2', title: 'solo', supersedes: ['claude-code:gone'] }])
  assert.deepEqual(merged, [{ id: 'bb:thr_2', title: 'solo' }])
})
