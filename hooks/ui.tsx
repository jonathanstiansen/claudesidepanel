import type { RenderChildren } from 'claude-code'

import { foldKey, noteKey, viewKey } from './model'
import type { BySurface, Ctx, Header, View } from './model'

// inverseText is the theme's page color: it keeps the desktop stars out of the pills
export const pill = (ctx: Ctx, key: string, children: RenderChildren) => {
  const { Box } = ctx.ui
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="subtle" backgroundColor="inverseText" paddingX={1} key={key}>
      {children}
    </Box>
  )
}

export type Fold = { id: string; folded: boolean }

// the title row: the ▾/▸ fold toggle, the title and count, then `aside` (pickers) at its right end
const head = (ctx: Ctx, title: string, count: number, aside?: RenderChildren, fold?: Fold) => {
  const { Box, Text, Button } = ctx.ui
  const label = (
    <Text key="title">
      <Text color="claude" bold>{title}</Text>
      <Text color="subtle"> · {count}</Text>
    </Text>
  )
  // the press is handled by register.tsx's ui.press hook, keyed by the Button
  const toggle = fold && (
    <Button key={foldKey(fold.id)} plain onPress={() => undefined}>
      <Text color="subtle">{fold.folded ? '▸' : '▾'}</Text>
    </Button>
  )
  const left = toggle ? (
    <Box key="left" flexDirection="row" gap={1}>
      {toggle}
      {label}
    </Box>
  ) : (
    label
  )
  if (!aside) return <Box key="head">{left}</Box>
  return (
    <Box key="head" flexDirection="row" justifyContent="space-between" alignItems="center" gap={1}>
      {left}
      <Box key="aside" flexDirection="row" gap={1}>
        {aside}
      </Box>
    </Box>
  )
}

export const sectionPill = (ctx: Ctx, key: string, title: string, count: number, body?: RenderChildren, aside?: RenderChildren, fold?: Fold) =>
  pill(ctx, key, [head(ctx, title, count, aside, fold), body])

// the choice is saved by register.tsx's ui.select hook, keyed by the Select
export const viewPicker = (ctx: Ctx, id: string, views: View<unknown>[], value?: string) => {
  const { Select } = ctx.ui
  return <Select key={viewKey(id)} value={value} options={views.map(v => ({ value: v.value, label: v.label ?? v.value }))} onSelect={() => undefined} />
}

export const nothingMatches = (ctx: Ctx) => {
  const { Text } = ctx.ui
  return (
    <Text key="none" color="subtle" italic>
      nothing matches this view
    </Text>
  )
}

// a box of pills; the terminal drops the outer border, nested borders eat its narrow width
export const groupPill: BySurface<(ctx: Ctx, key: string, title: string, count: number, inner: RenderChildren, fold?: Fold) => RenderChildren> = {
  default: (ctx, key, title, count, inner, fold) => {
    const { Box } = ctx.ui
    return (
      <Box flexDirection="column" borderStyle="round" borderColor="subtle" backgroundColor="inverseText" paddingX={1} paddingBottom={fold?.folded ? 0 : 1} gap={1} key={key}>
        {head(ctx, title, count, undefined, fold)}
        {inner}
      </Box>
    )
  },
  terminal: (ctx, key, title, count, inner, fold) => {
    const { Box } = ctx.ui
    return (
      <Box flexDirection="column" key={key}>
        {head(ctx, title, count, undefined, fold)}
        <Box flexDirection="column" paddingLeft={2}>
          {inner}
        </Box>
      </Box>
    )
  },
}

export const chips = (ctx: Ctx, list: string[], glyph: string, color: string) => {
  const { Text } = ctx.ui
  return (
    <Text key="chips">
      {list.map((name, i) => (
        <Text key={name}>
          {i > 0 ? '  ' : ''}
          <Text color={color}>{glyph}</Text> {name}
        </Text>
      ))}
    </Text>
  )
}

export const quietLine = (ctx: Ctx, names: string[]) => {
  const { Text } = ctx.ui
  return (
    <Text color="subtle" italic>
      💤 quiet so far · {names.join(' · ')}
    </Text>
  )
}

// one editable line in a pill; every edit autosaves through register.tsx's ui.input hook, keyed by the Input.
// (never name a parameter `h`: JSX compiles to the global h())
export const headerPill = (ctx: Ctx, head: Header, value: string) => {
  const { Box, Text, Input } = ctx.ui
  const style = head.style ?? {}
  return (
    <Box key={head.id} flexDirection="row" gap={1} borderStyle={style.borderStyle ?? 'round'} borderColor={style.borderColor ?? 'claude'} backgroundColor="inverseText" paddingX={1}>
      {head.label && (
        <Text color={style.labelColor ?? 'claude'} bold>
          {head.label}
        </Text>
      )}
      {/* no submitLabel: the desktop then draws no button, and every edit already autosaves */}
      <Input key={noteKey(head.id)} value={value} placeholder={head.placeholder} onSubmit={() => undefined} />
    </Box>
  )
}
