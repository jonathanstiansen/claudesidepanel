import { expect, test } from 'claude-code/testing'

import { skyRow } from './layers/starfield'

const text = (t: number, row: number) => skyRow(t, 40, row).map(s => s.ch).join('')

test('terminal sky rows fill the width and twinkle between frames', () => {
  expect(text(0, 0).length).toBe(40)
  expect(text(0, 0)).not.toBe(text(1, 0))
})

test('each sky row has its own stars', () => {
  expect(text(0, 0)).not.toBe(text(0, 1))
})

test('stars use the desktop tints', () => {
  const colors = new Set(skyRow(0, 400, 0).flatMap(s => (s.color ? [s.color] : [])))
  expect([...colors].every(c => ['#f2c14e', '#9b87f5', '#5fb3f0', '#f58ab8'].includes(c))).toBe(true)
  expect(colors.size).toBeGreaterThan(1)
})
