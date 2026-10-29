import { expect, test } from 'claude-code/testing'

import { statusOf } from './sections/prs'
import { findPrs } from './sources/prs'
import { pluginOf } from './sources/tools'

test('finds PR urls in text', () => {
  expect(findPrs('see https://github.com/acme/web/pull/42 and https://github.com/acme/api/pull/7.')).toEqual([
    { url: 'https://github.com/acme/web/pull/42', label: 'web#42' },
    { url: 'https://github.com/acme/api/pull/7', label: 'api#7' },
  ])
})

test('maps tools to plugins', () => {
  expect(pluginOf('Skill', 'ship:ship')).toBe('ship')
  expect(pluginOf('Skill', 'commit')).toBe(undefined)
  expect(pluginOf('mcp__linear-server__get_issue')).toBe('linear-server')
  expect(pluginOf('mcp__plugin_lodestone_lodestone__query')).toBe('lodestone_lodestone')
  expect(pluginOf('Bash')).toBe(undefined)
})

test('colors PRs by state', () => {
  const base = { url: 'u', label: 'l' }
  expect(statusOf({ ...base, state: 'MERGED' }).color).toBe('merged')
  expect(statusOf({ ...base, state: 'OPEN', isDraft: true }).word).toBe('draft')
  expect(statusOf({ ...base, state: 'CLOSED' }).color).toBe('error')
  expect(statusOf({ ...base, error: 'boom' }).color).toBe('warning')
})

test('icons per PR state', () => {
  const base = { url: 'u', label: 'l' }
  expect(statusOf({ ...base, state: 'OPEN' }).glyph).toBe('🔀')
  expect(statusOf({ ...base, state: 'OPEN', isDraft: true }).glyph).toBe('🚧')
  expect(statusOf({ ...base, state: 'MERGED' }).glyph).toBe('🎉')
  expect(statusOf({ ...base, state: 'CLOSED' }).glyph).toBe('🚫')
})
