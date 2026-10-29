import type { On } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { byStatus } from './sections/prs'

const PANE = { component: 'Pane', requestId: 'thread-refs', props: { title: 'Thread refs', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: {}, view: {} } } as const

const GH: Record<string, object> = {
  'https://github.com/a/b/pull/1': { url: 'https://github.com/a/b/pull/1', title: 'Merged one', state: 'MERGED', isDraft: false },
  'https://github.com/a/b/pull/2': { url: 'https://github.com/a/b/pull/2', title: 'Draft one', state: 'OPEN', isDraft: true },
  'https://github.com/a/b/pull/3': {
    url: 'https://github.com/a/b/pull/3', title: 'Broken one', state: 'OPEN', isDraft: false,
    statusCheckRollup: [{ __typename: 'CheckRun', name: 'jest', status: 'COMPLETED', conclusion: 'FAILURE' }],
  },
}
const ALL = 'https://github.com/a/b/pull/1 https://github.com/a/b/pull/2 https://github.com/a/b/pull/3'

// PRs found in a message, in this order: merged, draft, open with failing CI
const withPrs = async ($: Engine, on: On, text = ALL) => {
  const clock = mock.clock(on)
  on('process.run', async (_$, e) => ({
    value: { exitCode: 0, stdout: JSON.stringify(GH[e.argv[3] as string]), stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  }))
  await $.session.append({ door: 'prompt', origin: { kind: 'engine' }, uuid: 'u1', message: { type: 'user', role: 'user', content: [{ type: 'text' as const, text }] } })
  await clock.advance(10)
  return $.ui.mount({ plugin: 'thread-refs', surface: 'desktop', ...PANE } as never)
}

type Acts = { select: (t: { key: string; value: string }) => Promise<void>; redraw: () => Promise<void> }
type Picker = { props?: { value?: string; options?: { value: string }[] } } | undefined
const labels = async (ui: Awaited<ReturnType<typeof withPrs>>) => {
  const found = await Promise.all(['b#1', 'b#2', 'b#3'].map(async l => ((await ui.find({ type: 'Text', text: new RegExp(`^${l}$`) })) ? l : undefined)))
  return found.filter(Boolean)
}

test('the PR pill has a sort and a show picker in its title row', async ($, on) => {
  const ui = await withPrs($, on)
  const sort = (await ui.find({ key: 'view:prs.sort' })) as Picker
  const show = (await ui.find({ key: 'view:prs.show' })) as Picker
  expect(sort?.props?.options?.map(o => o.value)).toEqual(['found', 'status'])
  expect(show?.props?.options?.map(o => o.value)).toEqual(['all', 'open', 'draft', 'failing', 'merged'])
  expect([sort?.props?.value, show?.props?.value]).toEqual(['found', 'all'])
  await ui.unmount()
})

test('show open leaves drafts out, show draft keeps only drafts, and the choice is kept', async ($, on) => {
  const ui = await withPrs($, on)
  await (ui as unknown as Acts).select({ key: 'view:prs.show', value: 'open' })
  await (ui as unknown as Acts).redraw()
  expect(await labels(ui)).toEqual(['b#3'])
  await (ui as unknown as Acts).select({ key: 'view:prs.show', value: 'draft' })
  await (ui as unknown as Acts).redraw()
  expect(await labels(ui)).toEqual(['b#2'])
  expect(((await ui.find({ key: 'view:prs.show' })) as Picker)?.props?.value).toBe('draft')
  await ui.unmount()
})

test('a view that matches nothing keeps the pill and says so', async ($, on) => {
  const ui = await withPrs($, on, 'https://github.com/a/b/pull/1')
  await (ui as unknown as Acts).select({ key: 'view:prs.show', value: 'open' })
  await (ui as unknown as Acts).redraw()
  expect(await ui.find({ key: 'view:prs.show' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /nothing matches/ })).toBeDefined()
  await ui.unmount()
})

test('by status puts open PRs first, failing ones included, then draft, merged, closed', () => {
  const pr = (label: string, extra: object) => ({ url: label, label, ...extra })
  const fail = { state: 'fail', failing: ['x'] }
  const list = [pr('mf', { state: 'MERGED', ci: fail }), pr('m', { state: 'MERGED' }), pr('c', { state: 'CLOSED' }), pr('d', { state: 'OPEN', isDraft: true }), pr('f', { state: 'OPEN', ci: fail }), pr('o', { state: 'OPEN' })]
  // a merged PR whose CI failed is still merged: state comes first, the order found breaks ties
  expect(byStatus(list).map(p => p.label)).toEqual(['f', 'o', 'd', 'mf', 'm', 'c'])
})
