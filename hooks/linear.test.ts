import { expect, mock, test } from 'claude-code/testing'

import { ghPrView, linearOf, prFromGh } from './sources/prs'

const PANE = { component: 'Pane', requestId: 'thread-refs', props: { title: 'Thread refs', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: {}, view: {} } } as const

test('takes the Linear key from the title, else the branch', () => {
  expect(linearOf('chore(web): remove old endpoints [ABC-123]', 'feature/abc-123')).toBe('ABC-123')
  expect(linearOf('chore: no key here', 'feature/abc-123')).toBe('ABC-123')
  expect(linearOf('fix: two [ABC-1] then [DEF-2]', 'main')).toBe('ABC-1')
  expect(linearOf('fix: nothing', 'main')).toBeUndefined()
})

const ran = { exitCode: 0, stderr: '', stdout: JSON.stringify({ url: 'https://github.com/acme/web/pull/1', title: 'x [ABC-123]', state: 'OPEN', isDraft: false, headRefName: 'feature/abc-123' }) }

test('asks gh for the branch, and links the ticket in the configured Linear workspace', () => {
  expect(ghPrView('u').join(' ')).toContain('headRefName')
  expect(prFromGh({ url: 'https://github.com/acme/web/pull/1', label: 'web#1' }, ran, 'acme')?.linear).toBe('https://linear.app/acme/issue/ABC-123')
})

// no workspace is set until the installer picks one, so no link is guessed
test('without a Linear workspace there is no ticket link', () => {
  expect(prFromGh({ url: 'https://github.com/acme/web/pull/1', label: 'web#1' }, ran)?.linear).toBeUndefined()
})

const GH: Record<string, object> = {
  'https://github.com/acme/web/pull/1': { url: 'https://github.com/acme/web/pull/1', title: 'With [ABC-123]', state: 'OPEN', isDraft: false, headRefName: 'feature/abc-123' },
  'https://github.com/acme/web/pull/2': { url: 'https://github.com/acme/web/pull/2', title: 'Without', state: 'OPEN', isDraft: false, headRefName: 'main' },
}

type Acts = { press: (t: { key: string }) => Promise<void> }

for (const [name, options, url, ticket] of [
  ['a 🎫 beside a PR with a key opens its Linear ticket', { linearWorkspace: 'acme' }, 'https://github.com/acme/web/pull/1', 'https://linear.app/acme/issue/ABC-123'],
  ['a PR without a key has no ticket icon', { linearWorkspace: 'acme' }, 'https://github.com/acme/web/pull/2', undefined],
  ['no ticket icon until a Linear workspace is set', {}, 'https://github.com/acme/web/pull/1', undefined],
] as const) {
  test(name, { options }, async ($, on) => {
    const clock = mock.clock(on)
    const opened: string[] = []
    on('process.run', async (_$, e) => {
      if (e.argv[0] === 'open') opened.push(e.argv[1] as string)
      return { value: { exitCode: 0, stdout: JSON.stringify(GH[e.argv[3] as string] ?? {}), stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
    })
    await $.session.append({ door: 'prompt', origin: { kind: 'engine' }, uuid: 'u1', message: { type: 'user', role: 'user', content: [{ type: 'text' as const, text: url }] } })
    await clock.advance(10)
    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ plugin: 'thread-refs', surface, ...PANE } as never)
      const icon = await ui.find({ type: 'Text', text: /^🎫$/ })
      if (!ticket) expect(icon).toBeUndefined()
      else {
        expect(icon).toBeDefined()
        await (ui as unknown as Acts).press({ key: `open:${url}|${ticket}` })
        await clock.advance(10)
        expect(opened.at(-1)).toBe(ticket)
      }
      await ui.unmount()
    }
  })
}
