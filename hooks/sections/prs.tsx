import type { Pr } from '../../types'
import { openKey } from '../model'
import type { Picker, Section } from '../model'

export const statusOf = (pr: Pr): { glyph: string; color: string; word: string } =>
  pr.error
    ? { glyph: '⚠️', color: 'warning', word: 'gh failed' }
    : pr.isDraft
      ? { glyph: '🚧', color: 'inactive', word: 'draft' }
      : pr.state === 'MERGED'
        ? { glyph: '🎉', color: 'merged', word: 'merged' }
        : pr.state === 'CLOSED'
          ? { glyph: '🚫', color: 'error', word: 'closed' }
          : { glyph: '🔀', color: 'success', word: 'open' }

const isOpen = (pr: Pr) => pr.state === 'OPEN' && !pr.isDraft

// open (not draft) first, then draft, merged, closed; ties keep the order found.
// ponytail: a gh error row has no state yet, so it sorts last; give it its own rank if that hides problems
const rank = (pr: Pr) => (isOpen(pr) ? 0 : pr.isDraft ? 1 : pr.state === 'MERGED' ? 2 : pr.state === 'CLOSED' ? 3 : 4)
export const byStatus = (list: Pr[]) => [...list].sort((a, b) => rank(a) - rank(b))

const PICKERS: Picker<Pr>[] = [
  { id: 'sort', views: [{ value: 'found', label: 'as found' }, { value: 'status', label: 'by status', sort: byStatus }] },
  {
    id: 'show',
    views: [
      { value: 'all' },
      { value: 'open', filter: isOpen },
      { value: 'draft', filter: pr => pr.isDraft === true },
      { value: 'failing', filter: pr => pr.ci?.state === 'fail' },
      { value: 'merged', filter: pr => pr.state === 'MERGED' },
    ],
  },
]

const CI_LOOK = {
  pass: { glyph: '✅', color: 'success', word: 'ci passing' },
  fail: { glyph: '❌', color: 'error', word: 'ci failing' },
  pending: { glyph: '⏳', color: 'warning', word: 'ci running' },
} as const

export const prSection = (o: { id: string; title: string; quiet?: string; filter?: (pr: Pr) => boolean }): Section<Pr> => ({
  kind: 'section',
  id: o.id,
  title: o.title,
  quiet: o.quiet ?? 'PRs',
  source: 'prs',
  filter: o.filter,
  hint: '👆 click a PR or press its number to open',
  pickers: PICKERS,
  draw: (ctx, list) => {
    const { Box, Text, Button } = ctx.ui
    return (
      <Box flexDirection="column" gap={1} key="rows">
        {list.map(pr => {
          const look = statusOf(pr)
          const ci = pr.ci && CI_LOOK[pr.ci.state]
          return (
            <Box flexDirection="column" key={pr.url}>
              {/* the press itself is handled in register.tsx's ui.press hook: draws never hold `$` */}
              <Box key="label" flexDirection="row" gap={1}>
                <Button key={openKey(pr.url, pr.url)} plain hotkey={ctx.hotkey()} onPress={() => undefined}>
                  <Text bold strikethrough={pr.state === 'CLOSED'}>{pr.label}</Text>
                </Button>
                {pr.linear && (
                  <Button key={openKey(pr.url, pr.linear)} plain onPress={() => undefined}>
                    <Text>🎫</Text>
                  </Button>
                )}
              </Box>
              <Text wrap="truncate-end">
                <Text color={look.color}>{look.glyph} {look.word}</Text>
                {ci ? <Text color={ci.color}>{'  '}{ci.glyph} {ci.word}</Text> : ''}
              </Text>
              {pr.ci?.state === 'fail' && (
                <Text color="error" wrap="truncate-end">
                  ✗ {pr.ci.failing.join(', ')}
                </Text>
              )}
              <Text color={pr.error ? 'warning' : 'subtle'} italic={!pr.error} wrap="truncate-end">
                {pr.error ?? pr.title}
              </Text>
            </Box>
          )
        })}
      </Box>
    )
  },
})
