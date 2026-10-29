import { expect, mock, test } from 'claude-code/testing'

import type { Pr } from '../types'

// a reload reruns session.start; wiping the lists there makes the pane flash and reorder
test('a restart keeps the PRs already found', async ($, on) => {
  const clock = mock.clock(on)
  let prs: Pr[] = []
  on('state.set', { plugin: 'thread-refs', key: 'prs' }, async (_$, e, next) => {
    prs = e.value as Pr[]
    return next(e)
  })
  on('process.run', async () => ({ value: { exitCode: 0, stdout: JSON.stringify({ url: 'https://github.com/a/b/pull/1', title: 'T', state: 'OPEN', isDraft: false }), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('session.start', async () => ({ cwd: '/tmp' }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('agent.list', async () => ({ value: [] }) as never)
  on('session.messages', async () => ({ value: [] }) as never)
  await $.session.append({ door: 'prompt', origin: { kind: 'engine' }, uuid: 'u1', message: { type: 'user', role: 'user', content: [{ type: 'text' as const, text: 'https://github.com/a/b/pull/1' }] } })
  await clock.advance(10)
  expect(prs.map(p => p.url)).toEqual(['https://github.com/a/b/pull/1'])
  await $.session.start({ source: 'startup', cwd: '/tmp' } as never)
  await clock.advance(10)
  expect(prs.map(p => p.url)).toEqual(['https://github.com/a/b/pull/1'])
})
