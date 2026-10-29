import type { Section } from '../model'
import { chips } from '../ui'

// a section that shows its names as one line of glyph chips
export const chipSection = (o: { id: string; title: string; quiet: string; source: 'skills' | 'plugins'; glyph: string; color: string }): Section<string> => ({
  kind: 'section',
  id: o.id,
  title: o.title,
  quiet: o.quiet,
  source: o.source,
  draw: (ctx, list) => chips(ctx, list, o.glyph, o.color),
})
