import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import type { Pr } from '../types'

const ran = (exitCode: number, stdout: string, stderr = '') => ({
  value: { exitCode, stdout, stderr, isStdoutTruncated: false, isStderrTruncated: false },
})

const setup = async ($: Engine, on: On, answer: () => ReturnType<typeof ran>) => {
  const clock = mock.clock(on)
  let prs: Pr[] = []
  on('state.set', { plugin: 'thread-refs', key: 'prs' }, async (_$, e, next) => {
    prs = e.value as Pr[]
    return next(e)
  })
  on('process.run', async () => answer())
  await $.session.append({
    door: 'prompt',
    origin: { kind: 'engine' },
    uuid: 'u1',
    message: { type: 'user', role: 'user', content: [{ type: 'text' as const, text: 'see https://github.com/old-org/b/pull/1' }] },
  })
  await clock.advance(10)
  return () => prs
}

test('adds the PR under the canonical url gh returns', async ($, on) => {
  const prs = await setup($, on, () =>
    ran(0, JSON.stringify({ url: 'https://github.com/new-org/b/pull/1', title: 'Real title', state: 'OPEN', isDraft: false })),
  )
  expect(prs()).toEqual([
    { url: 'https://github.com/new-org/b/pull/1', label: 'b#1', title: 'Real title', state: 'OPEN', isDraft: false },
  ])
})

test('skips links gh says are not PRs', async ($, on) => {
  const prs = await setup($, on, () => ran(1, '', "GraphQL: Could not resolve to a Repository with the name 'old-org/b'.\n"))
  expect(prs()).toEqual([])
})

test('shows any other gh failure on the row', async ($, on) => {
  const prs = await setup($, on, () => ran(4, '', 'To get started with GitHub CLI, please run:  gh auth login\n'))
  expect(prs()).toEqual([
    { url: 'https://github.com/old-org/b/pull/1', label: 'b#1', error: 'To get started with GitHub CLI, please run:  gh auth login' },
  ])
})
