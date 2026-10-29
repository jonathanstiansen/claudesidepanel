import type { AgentRow } from '../../types'
import type { Section } from '../model'

const AGENT_LOOK: Record<string, { glyph: string; color: string }> = {
  pending: { glyph: '⏳', color: 'warning' },
  running: { glyph: '⏳', color: 'warning' },
  waiting: { glyph: '⏸️', color: 'warning' },
  idle: { glyph: '💤', color: 'subtle' },
  completed: { glyph: '✅', color: 'success' },
  failed: { glyph: '❌', color: 'error' },
  killed: { glyph: '🛑', color: 'error' },
}

export const agentSection = (o: { id: string; title: string; quiet?: string }): Section<AgentRow> => ({
  kind: 'section',
  id: o.id,
  title: o.title,
  quiet: o.quiet ?? 'agents',
  source: 'agents',
  draw: (ctx, list) => {
    const { Text } = ctx.ui
    return list.map(a => {
      const look = AGENT_LOOK[a.status] ?? { glyph: '•', color: 'subtle' }
      return (
        <Text key={a.id} wrap="truncate-end">
          <Text color={look.color}>{look.glyph}</Text> <Text bold>{a.name ?? a.type}</Text>{' '}
          <Text color="subtle">{a.description}</Text>
        </Text>
      )
    })
  },
})
