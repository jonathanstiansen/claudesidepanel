import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const mount = ($: Engine) =>
  $.ui.mount({
    plugin: 'thread-refs',
    surface: 'terminal',
    component: 'Pane',
    requestId: 'thread-refs',
    props: {},
    viewport: { columns: 220, rows: 60 },
  } as never)

test('terminal: stars sit between the panels, never in an overlapping layer', async $ => {
  const ui = await mount($)
  expect(await ui.find({ type: 'Text', text: /quiet so far/i })).toBeDefined()
  expect(await ui.find({ key: 'stars' })).toBeUndefined()
  expect(await ui.find({ key: 'sky-top' })).toBeDefined()
  expect(await ui.find({ key: 'sky-bottom' })).toBeDefined()
  await ui.unmount()
})

test('terminal: the bottom sky grows to the bottom of the window', async $ => {
  const ui = await mount($)
  const root = (await ui.find({ key: 'root' })) as { props?: { minHeight?: number } } | undefined
  const bottom = (await ui.find({ key: 'sky-bottom' })) as { props?: { flexGrow?: number } } | undefined
  expect(root?.props?.minHeight).toBeGreaterThan(40)
  expect(bottom?.props?.flexGrow).toBe(1)
  await ui.unmount()
})
