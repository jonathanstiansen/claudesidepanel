import { expect, mock, test } from 'claude-code/testing'

const PANE = { component: 'Pane', requestId: 'thread-refs', props: { title: 'Thread refs', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: {}, view: {} } } as const

type Acts = { press: (t: { key: string }) => Promise<void>; redraw: () => Promise<void> }

test('a pill folds to its title row and opens again, and stays as left', async ($, on) => {
  const clock = mock.clock(on)
  on('process.run', async () => ({
    value: { exitCode: 0, stdout: JSON.stringify({ url: 'https://github.com/a/b/pull/1', title: 'One', state: 'OPEN', isDraft: false }), stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  }))
  await $.session.append({ door: 'prompt', origin: { kind: 'engine' }, uuid: 'u1', message: { type: 'user', role: 'user', content: [{ type: 'text' as const, text: 'https://github.com/a/b/pull/1' }] } })
  await clock.advance(10)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'thread-refs', surface, ...PANE } as never)
    const acts = ui as unknown as Acts
    expect(await ui.find({ type: 'Text', text: /^b#1$/ })).toBeDefined()
    await acts.press({ key: 'fold:prs' })
    await acts.redraw()
    expect(await ui.find({ type: 'Text', text: /PULL REQUESTS/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^b#1$/ })).toBeUndefined()
    expect(await ui.find({ key: 'view:prs.show' })).toBeUndefined()
    await acts.press({ key: 'fold:prs' })
    await acts.redraw()
    expect(await ui.find({ type: 'Text', text: /^b#1$/ })).toBeDefined()
    await ui.unmount()
  }
})

test('a folded group hides the pills inside it', async ($, on) => {
  on('session.start', async () => ({ cwd: '/tmp' }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('agent.list', async () => ({ value: [] }) as never)
  on('session.messages', async () => ({ value: [{ toolUses: [{ tool: 'Skill', input: { skill: 'ship:ship' } }] }] }) as never)
  await $.session.start({ source: 'startup', cwd: '/tmp' } as never)
  const ui = await $.ui.mount({ plugin: 'thread-refs', surface: 'desktop', ...PANE } as never)
  expect(await ui.find({ type: 'Text', text: /SKILLS/ })).toBeDefined()
  await (ui as unknown as Acts).press({ key: 'fold:tooling' })
  await (ui as unknown as Acts).redraw()
  expect(await ui.find({ type: 'Text', text: /TOOLING/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /SKILLS/ })).toBeUndefined()
  await ui.unmount()
})
