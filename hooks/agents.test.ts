import type { AgentInfo } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import type { AgentRow } from '../types'

test('keeps sub-agents after the engine drops them, with their last status', async ($, on) => {
  const clock = mock.clock(on)
  let listed: AgentInfo[] = [{ id: 'a1', description: 'Find PR links', type: 'Explore', status: 'running' }]
  let agents: AgentRow[] = []
  on('state.set', { plugin: 'thread-refs', key: 'agents' }, async (_$, e, next) => {
    agents = e.value as AgentRow[]
    return next(e)
  })
  on('agent.list', async () => ({ value: listed }))
  on('session.start', async () => ({ cwd: '/tmp' }) as never)
  on('session.messages', async () => ({ value: [] }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  await $.session.start({ source: 'startup', cwd: '/tmp' } as never)

  await clock.advance(5_000)
  expect(agents).toEqual([{ id: 'a1', description: 'Find PR links', type: 'Explore', status: 'running' }])

  listed = [{ id: 'a1', description: 'Find PR links', type: 'Explore', status: 'completed' }]
  await clock.advance(5_000)
  listed = []
  await clock.advance(5_000)
  expect(agents).toEqual([{ id: 'a1', description: 'Find PR links', type: 'Explore', status: 'completed' }])
})
