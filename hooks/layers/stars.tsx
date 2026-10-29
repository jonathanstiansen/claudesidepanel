
import type { Layer } from '../model'
import { STARFIELD, STARFIELD_SIZE, skyRuns } from './starfield'


export const stars: Layer = {
  id: 'stars',
  behind: {
    default: ctx => {
      const { Box, Svg } = ctx.ui
      return (
        <Box key="stars" position="absolute" top={0} left={0} right={0} bottom={0} overflow="hidden">
          <Svg source={STARFIELD} alt="twinkling stars" width={STARFIELD_SIZE.width} height={STARFIELD_SIZE.height} isInteractive />
        </Box>
      )
    },
    terminal: () => undefined,
  },
  // ponytail: the terminal can't layer text under boxes, so its stars fill the rows between blocks instead
  between: {
    terminal: (ctx, snap, key, rows, firstRow, grow) => {
      const { Box, Text } = ctx.ui
      return (
        // grow: height 0 + flexGrow takes only the room left, and clips the rest, so it fills to the bottom without scrolling
        <Box key={key} flexDirection="column" {...(grow ? { flexGrow: 1, height: 0, overflow: 'hidden' } : {})}>
          {Array.from({ length: rows }, (_, i) => firstRow + i).map(row => (
            <Text key={String(row)} wrap="truncate-end">
              {skyRuns(snap.tick, ctx.size.columns, row).map((run, i) =>
                typeof run === 'string' ? run : <Text key={String(i)} color={run.color}>{run.ch}</Text>,
              )}
            </Text>
          ))}
        </Box>
      )
    },
  },
}
