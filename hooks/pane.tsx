import type { RenderNode } from 'claude-code'

import { countOf, isShown, pick, pickerId, quietOf } from './model'
import type { Ctx, Layer, Node, Resolved, Section, Snapshot } from './model'
import { groupPill, headerPill, nothingMatches, pill, quietLine, sectionPill, viewPicker } from './ui'

export const PANE = 'thread-refs'

const resolveNode = (snap: Snapshot, n: Node): Resolved =>
  n.kind === 'header'
    ? { kind: 'header', node: n, value: snap.notes[n.id] ?? '' } // no note yet is a genuinely empty field
    : n.kind === 'group'
      ? { kind: 'group', node: n, children: n.children.map(c => resolveNode(snap, c)), folded: snap.folded[n.id] === true }
      : resolveSection(snap, n)

function resolveSection(snap: Snapshot, n: Section): Resolved {
  const base = (snap[n.source] as unknown[]).filter(item => n.filter?.(item) ?? true)
  let items = base
  const picked: Record<string, string> = {}
  for (const p of n.pickers ?? []) {
    // an unknown or unset choice is the picker's first view, its default
    const view = p.views.find(v => v.value === snap.views[pickerId(n.id, p.id)]) ?? p.views[0]
    if (!view) throw new Error(`thread-refs: picker ${n.id}.${p.id} has no views`)
    picked[p.id] = view.value
    if (view.filter) items = items.filter(view.filter)
    if (view.sort) items = view.sort(items)
  }
  return { kind: 'section', node: n, items, total: base.length, picked, folded: snap.folded[n.id] === true }
}

const drawNode = (ctx: Ctx, r: Resolved): RenderNode => {
  if (r.kind === 'header') return headerPill(ctx, r.node, r.value) as RenderNode
  const fold = { id: r.node.id, folded: r.folded }
  // folded: the title row and count only, no rows, pickers or hint
  if (r.kind === 'section') {
    if (r.folded) return sectionPill(ctx, r.node.id, r.node.title, r.items.length, undefined, undefined, fold)
    const body = r.items.length > 0 ? pick(r.node.draw, ctx.surface)(ctx, r.items) : nothingMatches(ctx)
    const pickers = r.node.pickers?.map(p => viewPicker(ctx, pickerId(r.node.id, p.id), p.views, r.picked[p.id]))
    return sectionPill(ctx, r.node.id, r.node.title, r.items.length, body, pickers, fold)
  }
  if (r.folded) return pick(groupPill, ctx.surface)(ctx, r.node.id, r.node.title, countOf(r), [], fold) as RenderNode
  const { Box } = ctx.ui
  const quiet = r.children.filter(c => !isShown(c)).flatMap(quietOf)
  const inner = [
    ...r.children.filter(isShown).map(c => drawNode(ctx, c)),
    ...(quiet.length > 0 ? [<Box key="quiet">{quietLine(ctx, quiet)}</Box>] : []),
  ]
  return pick(groupPill, ctx.surface)(ctx, r.node.id, r.node.title, countOf(r), inner, fold) as RenderNode
}

const hintsOf = (r: Resolved): string[] =>
  r.kind === 'header' || r.folded || countOf(r) === 0 ? [] : r.kind === 'section' ? (r.node.hint ? [r.node.hint] : []) : r.children.flatMap(hintsOf)

// pure: draws the snapshot state.ts read, so it can be tested with any data
export function drawPane(ctx: Ctx, snap: Snapshot, nodes: Node[], layers: Layer[]) {
  const { Box, Text } = ctx.ui
  const resolved = nodes.map(n => resolveNode(snap, n))

  const behind = layers.flatMap(l => {
    const node = l.behind && pick(l.behind, ctx.surface)?.(ctx, snap)
    return node ? [node] : []
  })
  // ponytail: first layer with a `between` for this surface fills the gaps; stack them if two ever want to
  const fill = layers.map(l => ({ draw: l.between && pick(l.between, ctx.surface) })).find(f => f.draw)
  let rowsUsed = 0 // each filler row gets its own number, so no two rows of stars look alike
  const spacer = (key: string, rows: number, grow?: boolean) => {
    if (!fill?.draw) return <Box key={key} height={rows} />
    const node = fill.draw(ctx, snap, key, rows, rowsUsed, grow)
    rowsUsed += rows
    return node
  }

  const quiet = resolved.filter(r => !isShown(r)).flatMap(quietOf)
  const blocks = [
    ...resolved.filter(isShown).map(r => drawNode(ctx, r)),
    ...(quiet.length > 0 ? [pill(ctx, 'quiet', quietLine(ctx, quiet))] : []),
  ]

  return (
    <Box key="root" flexDirection="column" position="relative" overflow="hidden" minHeight={ctx.size.fillRows}>
      {behind}
      {/* gaps come from the filler rows where there is one, else from the box's own gap */}
      <Box flexDirection="column" gap={fill ? 0 : 1} paddingBottom={fill ? 0 : 1} flexGrow={1}>
        {/* an absolute child makes the desktop give this box position:relative, so it paints above the layers behind */}
        {behind.length > 0 && <Box key="anchor" position="absolute" top={0} left={0} />}
        {spacer('sky-top', 3)}
        {fill ? blocks.flatMap((b, i) => [b, spacer(`sky-${i}`, 1)]) : blocks}
        {resolved.flatMap(hintsOf).map(hint => (
          <Text key={hint} color="subtle" italic>
            {' '}
            {hint}
          </Text>
        ))}
        {fill && spacer('sky-bottom', ctx.size.fillRows ?? 12, true)}
      </Box>
    </Box>
  )
}
