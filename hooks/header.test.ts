import { expect, test } from 'claude-code/testing'

const PANE = { component: 'Pane', requestId: 'thread-refs', props: { title: 'Thread refs', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: {}, view: {} } } as const

test('a GOAL header pill sits at the top, empty, on every surface', async $ => {
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'thread-refs', surface, ...PANE } as never)
    expect(await ui.find({ type: 'Text', text: /GOAL:/ })).toBeDefined()
    const field = (await ui.find({ key: 'note:goal' })) as { props?: { value?: string } } | undefined
    expect(field).toBeDefined()
    expect(field?.props?.value ?? '').toBe('')
    await ui.unmount()
  }
})

// the terminal redraws for its stars every 700ms, so typing must be saved as it happens, not only on Enter
test('what you type is kept across redraws', async $ => {
  const ui = await $.ui.mount({ plugin: 'thread-refs', surface: 'terminal', ...PANE } as never)
  // the generic mount handle's type drops the terminal's input act; it is there at runtime
  await (ui as unknown as { input: (t: { key: string; text: string; kind: 'change' }) => Promise<void> }).input({ key: 'note:goal', text: 'ship the refactor', kind: 'change' })
  await ui.redraw()
  const field = (await ui.find({ key: 'note:goal' })) as { props?: { value?: string } } | undefined
  expect(field?.props?.value).toBe('ship the refactor')
  await ui.unmount()
})

// the desktop draws a submit button only when submitLabel is set; typing autosaves, so there is none
test('the goal field has no save button', async $ => {
  const ui = await $.ui.mount({ plugin: 'thread-refs', surface: 'desktop', ...PANE } as never)
  const field = (await ui.find({ key: 'note:goal' })) as { props?: { submitLabel?: string } } | undefined
  expect(field?.props?.submitLabel).toBeUndefined()
  await ui.unmount()
})
