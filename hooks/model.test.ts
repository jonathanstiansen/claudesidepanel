import { expect, test } from 'claude-code/testing'

import { countOf, group, pick, quietOf } from './model'
import type { Resolved, Section } from './model'

const leaf = (id: string, items: string[], source = id): Resolved => ({
  kind: 'section',
  node: { kind: 'section', id, title: id, quiet: id, source } as unknown as Section,
  items,
  total: items.length,
  picked: {},
  folded: false,
})
const box = (children: Resolved[]): Resolved => ({ kind: 'group', node: group({ id: 'g', title: 'G', children: [] }), children, folded: false })

test('picks the surface implementation, else the default, else the one function', () => {
  const one = () => 'one'
  expect(pick(one, 'desktop')).toBe(one)
  const map = { default: () => 'd', terminal: () => 't' }
  expect(pick(map, 'terminal')()).toBe('t')
  expect(pick(map, 'desktop')()).toBe('d')
})

test('a group counts the items of every section inside it', () => {
  expect(countOf(box([leaf('skills', ['a']), box([leaf('plugins', ['b', 'c'])])]))).toBe(3)
})

test('quiet names are the empty sections, however deep', () => {
  expect(quietOf(box([leaf('skills', []), box([leaf('plugins', []), leaf('agents', ['x'])])]))).toEqual(['skills', 'plugins'])
})

