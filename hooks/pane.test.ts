import { expect, test } from 'claude-code/testing'

const PANE = { component: 'Pane', requestId: 'thread-refs', props: { title: 'Thread refs', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: {}, view: {} } } as const

test('draws the pane on every surface', async $ => {
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'thread-refs', surface, ...PANE } as never)
    expect(await ui.find({ type: 'Text', text: /quiet so far/ })).toBeDefined()
    await ui.unmount()
  }
})

test('twinkles an svg starfield behind the desktop pane, text stars between the terminal panels', async $ => {
  const desktop = await $.ui.mount({ plugin: 'thread-refs', surface: 'desktop', ...PANE } as never)
  expect(await desktop.find({ key: 'stars' })).toBeDefined()
  expect(await desktop.find({ type: 'Svg' })).toBeDefined()
  await desktop.unmount()
  const terminal = await $.ui.mount({ plugin: 'thread-refs', surface: 'terminal', ...PANE } as never)
  expect(await terminal.find({ key: 'stars' })).toBeUndefined()
  expect(await terminal.find({ type: 'Svg' })).toBeUndefined()
  expect(await terminal.find({ type: 'Text', text: /[·✧✦⋆]/ })).toBeDefined()
  await terminal.unmount()
})

test('folds empty sections into one quiet line', async $ => {
  const ui = await $.ui.mount({ plugin: 'thread-refs', surface: 'desktop', ...PANE } as never)
  expect(await ui.find({ type: 'Text', text: /SKILLS/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /quiet so far/i })).toBeDefined()
  await ui.unmount()
})

test('sizes the starfield so the desktop does not shrink it to a 300x150 frame', async $ => {
  const ui = await $.ui.mount({ plugin: 'thread-refs', surface: 'desktop', ...PANE } as never)
  const svg = (await ui.find({ type: 'Svg' })) as { props?: { width?: number; height?: number } } | undefined
  expect(svg?.props?.width).toBeGreaterThan(300)
  expect(svg?.props?.height).toBeGreaterThan(150)
  await ui.unmount()
})

test('opens with an empty band where only stars show', async $ => {
  const ui = await $.ui.mount({ plugin: 'thread-refs', surface: 'desktop', ...PANE } as never)
  expect(await ui.find({ key: 'sky-top' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /✦/ })).toBeUndefined()
  await ui.unmount()
})

test('stretches to the pane height so stars fill the empty space below', async $ => {
  const ui = await $.ui.mount({ plugin: 'thread-refs', surface: 'desktop', ...PANE, viewport: { columns: 40, rows: 50 } } as never)
  const root = (await ui.find({ key: 'root' })) as { props?: { minHeight?: number } } | undefined
  expect(root?.props?.minHeight).toBeGreaterThan(30)
  await ui.unmount()
})

test('groups skills and plugins as separate pills inside one Tooling box', async ($, on) => {
  on('session.start', async () => ({ cwd: '/tmp' }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('agent.list', async () => ({ value: [] }) as never)
  on('session.messages', async () => ({ value: [{ toolUses: [{ tool: 'Skill', input: { skill: 'ship:ship' } }, { tool: 'mcp__linear__get_issue', input: {} }] }] }) as never)
  await $.session.start({ source: 'startup', cwd: '/tmp' } as never)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'thread-refs', surface, ...PANE } as never)
    expect(await ui.find({ type: 'Text', text: /TOOLING/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /SKILLS/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /PLUGINS/ })).toBeDefined()
    await ui.unmount()
  }
})
