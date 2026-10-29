import { expect, test } from 'claude-code/testing'

test('opens the pane when a prompt names a PR', async ($, on) => {
  const opened: string[] = []
  on('ui.open', async (_$, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } } as never
  })
  on('prompt.submit', async (_$, e) => ({ text: e.text }))
  on('process.run', async () => ({ value: { exitCode: 1, stdout: '', stderr: 'not found', isStdoutTruncated: false, isStderrTruncated: false } }))
  await $.prompt.submit({ text: 'see https://github.com/acme/web/pull/42' } as never)
  expect(opened).toEqual(['thread-refs'])
})

test('leaves the pane alone for a prompt without a PR', async ($, on) => {
  const opened: string[] = []
  on('ui.open', async (_$, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } } as never
  })
  on('prompt.submit', async (_$, e) => ({ text: e.text }))
  await $.prompt.submit({ text: 'hello' } as never)
  expect(opened).toEqual([])
})
