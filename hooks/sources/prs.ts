import type { Ci, Pr } from '../../types'

// pure: register.tsx runs gh and keeps the atom; this file only parses and merges

const PR_URL = /https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/pull\/(\d+)/g
const NOT_A_PR = /Could not resolve|no pull requests found|not found/i

export const ghPrView = (url: string) => ['gh', 'pr', 'view', url, '--json', 'url,title,state,isDraft,statusCheckRollup,headRefName']

// a PR carries its Linear key as `[ABC-123]` in the title, or as `feature/abc-123` in the branch
const TITLE_KEY = /\[([A-Z][A-Z0-9]*-\d+)\]/
const BRANCH_KEY = /\b([a-z][a-z0-9]*-\d+)\b/i
export const linearOf = (title: string, branch: string): string | undefined =>
  title.match(TITLE_KEY)?.[1] ?? branch.match(BRANCH_KEY)?.[1]?.toUpperCase()

// the workspace is the installer's `linearWorkspace` setting; while it is unset no link is guessed
const linearUrl = (workspace: string, key: string) => `https://linear.app/${encodeURIComponent(workspace)}/issue/${key}`

export const findPrs = (text: string): Pr[] =>
  [...text.matchAll(PR_URL)].map(([url, , repo, n]) => ({ url, label: `${repo}#${n}` }))

type Check = { __typename?: string; name?: string; context?: string; status?: string; conclusion?: string | null; state?: string; startedAt?: string; createdAt?: string }

// gh lists every run of a check (a cancelled run, then its rerun); only the newest says where CI stands
const latestRuns = (checks: Check[]): Check[] => {
  const byName = new Map<string, Check>()
  for (const c of checks) {
    const name = c.name ?? c.context ?? '?'
    const prev = byName.get(name)
    if (!prev || (c.startedAt ?? c.createdAt ?? '') >= (prev.startedAt ?? prev.createdAt ?? '')) byName.set(name, c)
  }
  return [...byName.values()]
}

const FAILED = /^(FAILURE|TIMED_OUT|CANCELLED|ACTION_REQUIRED|STARTUP_FAILURE|ERROR)$/
const PENDING = /^(PENDING|EXPECTED|QUEUED|IN_PROGRESS|WAITING|REQUESTED)$/

export const ciOf = (checks: Check[]): Ci | undefined => {
  const real = latestRuns(checks).filter(c => !(c.name ?? c.context ?? '').startsWith('codecov/'))
  if (checks.length === 0) return undefined
  const failing = real.filter(c => FAILED.test(c.conclusion ?? c.state ?? '')).map(c => c.name ?? c.context ?? '?')
  if (failing.length > 0) return { state: 'fail', failing }
  const isRunning = real.some(c => (c.__typename === 'CheckRun' ? c.status !== 'COMPLETED' : PENDING.test(c.state ?? '')))
  return { state: isRunning ? 'pending' : 'pass', failing: [] }
}

// gh's answer → the row to show, under the canonical url gh returns; undefined when the link is no PR
export const prFromGh = (found: Pr, ran: { exitCode: number; stdout: string; stderr: string }, linearWorkspace?: string): Pr | undefined => {
  if (ran.exitCode === 0) {
    const pr = JSON.parse(ran.stdout) as Required<Pick<Pr, 'url' | 'title' | 'state' | 'isDraft'>> & { statusCheckRollup?: Check[]; headRefName?: string }
    const ci = ciOf(pr.statusCheckRollup ?? [])
    const key = linearOf(pr.title, pr.headRefName ?? '')
    return {
      url: pr.url,
      label: findPrs(pr.url)[0]?.label ?? found.label,
      title: pr.title,
      state: pr.state,
      isDraft: pr.isDraft,
      ...(ci && { ci }),
      ...(key && linearWorkspace && { linear: linearUrl(linearWorkspace, key) }),
    }
  }
  if (NOT_A_PR.test(ran.stderr)) return undefined
  return { ...found, error: ran.stderr.trim() }
}

// rows update in place, new ones go last, so a reload never reorders the pane
export const upsertPr = (list: Pr[], row: Pr): Pr[] =>
  list.some(o => o.url === row.url) ? list.map(o => (o.url === row.url ? row : o)) : [...list, row]
