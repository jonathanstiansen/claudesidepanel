import type { Artifact } from '../../types'
import { openKey } from '../model'
import type { Section } from '../model'

export const artifactSection = (o: { id: string; title: string; quiet?: string }): Section<Artifact> => ({
  kind: 'section',
  id: o.id,
  title: o.title,
  quiet: o.quiet ?? 'artifacts',
  source: 'artifacts',
  draw: (ctx, list) => {
    const { Box, Text, Button } = ctx.ui
    return (
      <Box key="rows" flexDirection="column">
        {list.map(a => (
          // the press is handled by register.tsx's ui.press hook, which opens the URL
          <Button key={openKey(o.id, a.url)} plain onPress={() => undefined}>
            <Text>
              <Text color="suggestion">🎨</Text> {a.label}
              {a.version && a.version > 1 ? <Text color="subtle"> v{a.version}</Text> : ''}
            </Text>
          </Button>
        ))}
      </Box>
    )
  },
})
