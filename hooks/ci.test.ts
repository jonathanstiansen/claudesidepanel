import { expect, test } from 'claude-code/testing'

import { ciOf } from './sources/prs'

const run = (name: string, status: string, conclusion: string | null) => ({ __typename: 'CheckRun', name, status, conclusion })
const ctx = (context: string, state: string) => ({ __typename: 'StatusContext', context, state })

test('ignores codecov failures', () => {
  expect(ciOf([run('Setup', 'COMPLETED', 'SUCCESS'), run('codecov/project', 'COMPLETED', 'FAILURE'), ctx('codecov/bundles', 'FAILURE')])).toEqual({ state: 'pass', failing: [] })
})

test('fails on any real failure, listing them', () => {
  expect(ciOf([run('lint', 'COMPLETED', 'FAILURE'), run('jest', 'IN_PROGRESS', null), ctx('deploy', 'ERROR')])).toEqual({ state: 'fail', failing: ['lint', 'deploy'] })
})

test('pending while anything runs', () => {
  expect(ciOf([run('Setup', 'COMPLETED', 'SKIPPED'), ctx('build', 'PENDING')])).toEqual({ state: 'pending', failing: [] })
})

test('no checks, no status', () => {
  expect(ciOf([])).toBe(undefined)
})

// gh keeps every run of a check; a run cancelled and then rerun green (seen on a real PR) is passing, not failing
test('judges only the latest run of each check', () => {
  const at = (name: string, conclusion: string, startedAt: string) => ({ __typename: 'CheckRun', name, status: 'COMPLETED', conclusion, startedAt })
  expect(
    ciOf([at('Lint PR Message', 'CANCELLED', '2026-10-08T18:26:05Z'), at('Lint PR Message', 'SUCCESS', '2026-10-08T18:27:15Z'), at('Lint PR Message', 'SUCCESS', '2026-10-13T18:32:18Z')]),
  ).toEqual({ state: 'pass', failing: [] })
  expect(ciOf([at('jest', 'SUCCESS', '2026-10-08T18:00:00Z'), at('jest', 'FAILURE', '2026-10-09T18:00:00Z')])).toEqual({ state: 'fail', failing: ['jest'] })
})
