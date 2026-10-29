import { expect, test } from 'claude-code/testing'

import { DEFAULT_SECTIONS, layoutOf } from './layout'

const PANE = { component: 'Pane', requestId: 'thread-refs', props: { title: 'Thread refs', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: {}, view: {} } } as const

test('every section shows by default, in the usual order', () => {
  expect(DEFAULT_SECTIONS).toBe('goal,prs,artifacts,agents,tooling')
  expect(layoutOf(DEFAULT_SECTIONS).map(n => n.id)).toEqual(['goal', 'prs', 'artifacts', 'agents', 'tooling'])
})

test('the sections setting picks which show and in what order', () => {
  expect(layoutOf('tooling, prs').map(n => n.id)).toEqual(['tooling', 'prs'])
  expect(layoutOf('').map(n => n.id)).toEqual([])
})

test('an unknown or repeated section fails loudly, naming it', () => {
  expect(() => layoutOf('prs,nope')).toThrow(/nope/)
  expect(() => layoutOf('prs,prs')).toThrow(/prs/)
})

test('a section left out of the setting is not drawn', { options: { sections: 'prs' } }, async $ => {
  const ui = await $.ui.mount({ plugin: 'thread-refs', surface: 'desktop', ...PANE } as never)
  expect(await ui.find({ type: 'Text', text: /GOAL:/ })).toBeUndefined()
  await ui.unmount()
})
