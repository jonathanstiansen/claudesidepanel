import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import type { Pr } from '../types'

// session.append can be skipped by a plugin above this one, so PRs must also come from
// the prompt, every tool call, and the turn's answer
const watch = (on: On) => {
  const clock = mock.clock(on)
  let prs: Pr[] = []
  on('state.set', { plugin: 'thread-refs', key: 'prs' }, async (_$, e, next) => {
    prs = e.value as Pr[]
    return next(e)
  })
  on('process.run', async (_$, e) => ({
    value: { exitCode: 0, stdout: JSON.stringify({ url: e.argv[3], title: 'T', state: 'OPEN', isDraft: false, headRefName: 'main' }), stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  }))
  return { clock, urls: () => prs.map(p => p.url) }
}

test('a PR link typed in a prompt is picked up', async ($, on) => {
  const { clock, urls } = watch(on)
  on('prompt.submit', async (_$, e) => ({ text: e.text }))
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  await $.prompt.submit({ text: 'look at https://github.com/a/b/pull/5' } as never)
  await clock.advance(10)
  expect(urls()).toEqual(['https://github.com/a/b/pull/5'])
})

test('a PR link in a tool call or its answer is picked up', async ($, on) => {
  const { clock, urls } = watch(on)
  on('tool.call', async () => ({ result: 'created', text: 'https://github.com/a/b/pull/7\n' }) as never)
  await $.tool.call({ tool: 'Bash', command: 'gh pr view https://github.com/a/b/pull/6' } as never)
  await clock.advance(10)
  expect(urls().sort()).toEqual(['https://github.com/a/b/pull/6', 'https://github.com/a/b/pull/7'])
})

test("a PR link in the turn's answer is picked up", async ($, on) => {
  const { clock, urls } = watch(on)
  on('turn.complete', async () => ({ text: '' }))
  // the reply is the input's `answer`: the assistant's final visible text of the turn
  await $.turn.complete({ reason: 'answer', answer: 'Opened https://github.com/a/b/pull/9 for review.', durationMs: 1, isAborted: false, turnId: 't1' } as never)
  await clock.advance(10)
  expect(urls()).toEqual(['https://github.com/a/b/pull/9'])
})
