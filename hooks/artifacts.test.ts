import { expect, mock, test } from 'claude-code/testing'

import { artifactFromTool, upsertArtifacts } from './sources/artifacts'

const PANE = { component: 'Pane', requestId: 'thread-refs', props: { title: 'Thread refs', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: {}, view: {} } } as const

// the three result shapes the Artifact tool answers with (made-up paths and ids)
const PUBLISHED = 'Published /home/dev/demo/trace-explorer/index.html at https://claude.ai/artifact/Aa1Bb2Cc3Dd4Ee5Ff6Gg7H (Version 2, version id 1791563839-d7dc) Icon: "search".'
const CREATED = 'Created a new Artifact at https://claude.ai/artifact/Zz9Yy8Xx7Ww6Vv5Uu4Tt3S (version 1792687109-a3d7) from the Artifact type https://claude.ai/artifact/Type1Type2Type3Type4Ty (release 1792685381-8582). File names below are names chosen by the type\'s publisher'
const UPDATED = 'Updated the Artifact at https://claude.ai/artifact/Zz9Yy8Xx7Ww6Vv5Uu4Tt3S (Version 4, version id 1792687433-b234) with /tmp/x/board/project/Timeline.dc.html (and any `files` listed); own files not sent this time were kept. Its page comes from the Artifact type https://claude.ai/artifact/Type1Type2Type3Type4Ty'
const BOARD = 'https://claude.ai/artifact/Zz9Yy8Xx7Ww6Vv5Uu4Tt3S'

test('a publish is named by its title, else its folder for an index.html, else its file', () => {
  expect(artifactFromTool({ file_path: '/x/trace-explorer/index.html' }, PUBLISHED)).toEqual({ url: 'https://claude.ai/artifact/Aa1Bb2Cc3Dd4Ee5Ff6Gg7H', label: 'trace-explorer', version: 2 })
  expect(artifactFromTool({ title: 'Traces' }, PUBLISHED)?.label).toBe('Traces')
  expect(artifactFromTool({}, 'Published /tmp/out/report.html at https://claude.ai/code/artifact/abc-123 (Version 1, x)')?.label).toBe('report.html')
})

test('an artifact made from a type is named by the title it was given', () => {
  expect(artifactFromTool({ title: 'Release Notes Board', type_url: 'https://claude.ai/artifact/Type1Type2Type3Type4Ty' }, CREATED)).toEqual({ url: BOARD, label: 'Release Notes Board', version: 1 })
})

test('an update bumps the version and brings no label of its own', () => {
  expect(artifactFromTool({ url: BOARD, file_path: '/x/Timeline.dc.html' }, UPDATED)).toEqual({ url: BOARD, version: 4 })
})

test('quickstart, list, read and failed calls are not artifacts this session made', () => {
  expect(artifactFromTool({ action: 'quickstart' }, 'Quickstart. … publish with `type_url`: "https://claude.ai/artifact/Tmpl1Tmpl2Tmpl3Tmpl4Tm"')).toBeUndefined()
  expect(artifactFromTool({ action: 'read', url: BOARD }, `Files saved under "/tmp/x" from version 1 of ${BOARD}, an Artifact of type "Design".`)).toBeUndefined()
  expect(artifactFromTool({ file_path: '/x/a.html' }, 'root: "/x" is outside the working directory')).toBeUndefined()
})

test('an update keeps the row and its label, a new row without a label is named by its id', () => {
  const board = { url: BOARD, label: 'Release Notes Board', version: 1 }
  expect(upsertArtifacts([board], { url: BOARD, version: 4 })).toEqual([{ ...board, version: 4 }])
  expect(upsertArtifacts([], { url: BOARD, version: 4 })).toEqual([{ url: BOARD, label: 'Zz9Yy8Xx7Ww6Vv5Uu4Tt3S', version: 4 }])
})

// a tool.call event carries the tool's fields at its top level, as the engine raises it
const answer = (text: string) => ({ result: text, text })

test('artifacts made live show up as they are made, and updates keep their name', async ($, on) => {
  let next = CREATED
  on('tool.call', async () => answer(next) as never)
  await $.tool.call({ tool: 'Artifact', title: 'Release Notes Board', type_url: 'https://claude.ai/artifact/Type1Type2Type3Type4Ty' } as never)
  next = UPDATED
  await $.tool.call({ tool: 'Artifact', url: BOARD, file_path: '/x/Timeline.dc.html' } as never)
  const ui = await $.ui.mount({ plugin: 'thread-refs', surface: 'desktop', ...PANE } as never)
  expect(await ui.find({ type: 'Text', text: /Release Notes Board/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /v4/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Timeline/ })).toBeUndefined()
  await ui.unmount()
})

test('artifacts made earlier in the session show up at start', async ($, on) => {
  on('session.start', async () => ({ cwd: '/tmp' }) as never)
  on('command.register', async () => ({ value: undefined }) as never)
  on('ui.open', async () => ({ value: { isPlaced: true } }) as never)
  on('agent.list', async () => ({ value: [] }) as never)
  on('session.messages', async () => ({ value: [{ toolUses: [{ tool: 'Artifact', input: { title: 'Release Notes Board' }, text: CREATED }] }] }) as never)
  await $.session.start({ source: 'startup', cwd: '/tmp' } as never)
  const ui = await $.ui.mount({ plugin: 'thread-refs', surface: 'desktop', ...PANE } as never)
  expect(await ui.find({ type: 'Text', text: /Release Notes Board/ })).toBeDefined()
  await ui.unmount()
})

test('each artifact in the pill is a button that opens it', async ($, on) => {
  const clock = mock.clock(on)
  const opened: string[] = []
  on('process.run', async (_$, e) => {
    if (e.argv[0] === 'open') opened.push(e.argv[1] as string)
    return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('tool.call', async () => answer(PUBLISHED) as never)
  await $.tool.call({ tool: 'Artifact', file_path: '/x/trace-explorer/index.html' } as never)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'thread-refs', surface, ...PANE } as never)
    expect(await ui.find({ type: 'Text', text: /trace-explorer/ })).toBeDefined()
    await (ui as unknown as { press: (t: { key: string }) => Promise<void> }).press({ key: 'open:artifacts|https://claude.ai/artifact/Aa1Bb2Cc3Dd4Ee5Ff6Gg7H' })
    await clock.advance(10)
    expect(opened.at(-1)).toBe('https://claude.ai/artifact/Aa1Bb2Cc3Dd4Ee5Ff6Gg7H')
    await ui.unmount()
  }
})
