import type { RenderChildren, RenderNode, RenderSurface } from 'claude-code'

import type { AgentRow, Artifact, Pr } from '../types'

// one function for every surface, or one per surface with an optional default
export type BySurface<F> = F | ({ default?: F } & Partial<Record<RenderSurface, F>>)

export const pick = <F>(impl: BySurface<F>, surface: RenderSurface): F =>
  typeof impl === 'function' ? impl : ((impl as Record<string, F>)[surface] ?? (impl as { default: F }).default)

// what every draw gets, worked out once per render in surface.ts. No `$` in here: the engine refuses `$`
// stored in an object, so draws stay pure and pane.tsx / register.tsx do every read and press.
export type Ctx = {
  ui: { Box: any; Text: any; Button: any; Input: any; Select: any; Link: any; Svg?: any } // ponytail: loose element table, type per surface if a draw needs more
  surface: RenderSurface
  can: { svg: boolean }
  size: { columns: number; fillRows?: number }
  hotkey: () => string | undefined
}

// everything the pane draws from, read once per draw by state.ts. The engine only reads atoms named in
// a const of the reading file, so reads can't be generic: sections pick their list out of this by key.
export type Snapshot = { prs: Pr[]; artifacts: Artifact[]; agents: AgentRow[]; skills: string[]; plugins: string[]; tick: number; notes: Record<string, string>; views: Record<string, string>; folded: Record<string, boolean> }
export type SourceKey = 'prs' | 'artifacts' | 'agents' | 'skills' | 'plugins'

// one way to look at a section: a filter, a sort, or both
export type View<T> = { value: string; label?: string; filter?: (item: T) => boolean; sort?: (items: T[]) => T[] }

// one dropdown of views in a section's title row; its first view is the default
export type Picker<T> = { id: string; views: View<T>[] }

export type Section<T = any> = {
  kind: 'section'
  id: string
  title: string
  quiet: string
  source: SourceKey
  filter?: (item: T) => boolean
  hint?: string // shown under the pills while the section has items
  pickers?: Picker<T>[] // dropdowns in the title row, applied in order
  draw: BySurface<(ctx: Ctx, items: T[]) => RenderChildren>
}

export type Group = { kind: 'group'; id: string; title: string; children: Node[] }

// how a header pill looks; colors are theme keys or hex, border one of the Box border styles
export type HeaderStyle = { borderColor?: string; borderStyle?: string; labelColor?: string }

// a pill holding one editable line, kept per id in the notes atom; always drawn, never counted
export type Header = { kind: 'header'; id: string; label?: string; placeholder?: string; style?: HeaderStyle }

export type Node = Section | Group | Header

// decoration around the pills: `behind` is a full-pane background (desktop), `between` fills the rows
// between pills (terminal, where an absolute layer blanks the pane)
export type Layer = {
  id: string
  behind?: BySurface<(ctx: Ctx, snap: Snapshot) => RenderNode | undefined>
  between?: BySurface<(ctx: Ctx, snap: Snapshot, key: string, rows: number, firstRow: number, grow?: boolean) => RenderNode>
}

export const group = (g: Omit<Group, 'kind'>): Group => ({ kind: 'group', ...g })

export const header = (h: Omit<Header, 'kind'>): Header => ({ kind: 'header', ...h })

// an Input's key carries its header's id, so register.tsx's ui.input hook knows which note to save
const NOTE = 'note:'
export const noteKey = (id: string) => NOTE + id
export const noteIdOf = (key: string) => (key.startsWith(NOTE) ? key.slice(NOTE.length) : undefined)

// a picker's Select key carries `<section>.<picker>`, which is also where register.tsx's ui.select hook saves it
const VIEW = 'view:'
export const pickerId = (section: string, picker: string) => `${section}.${picker}`
export const viewKey = (id: string) => VIEW + id
export const viewIdOf = (key: string) => (key.startsWith(VIEW) ? key.slice(VIEW.length) : undefined)

// a Button that opens a URL: `open:<owner>|<url>`. The owner (its row) keeps keys unique when two rows
// open the same URL; register.tsx's ui.press hook opens the URL. A Link is not used, because the desktop
// draws some https links (claude.ai's own) as plain unclickable text.
const OPEN = 'open:'
export const openKey = (owner: string, url: string) => `${OPEN}${owner}|${url}`
export const openUrlOf = (key: string) => (key.startsWith(OPEN) && key.includes('|') ? key.slice(key.indexOf('|') + 1) : undefined)

// a pill's ▾/▸ Button key carries its id, for register.tsx's ui.press hook
const FOLD = 'fold:'
export const foldKey = (id: string) => FOLD + id
export const foldIdOf = (key: string) => (key.startsWith(FOLD) ? key.slice(FOLD.length) : undefined)

// a node with its items read, ready to draw
export type Resolved =
  | { kind: 'section'; node: Section; items: unknown[]; total: number; picked: Record<string, string>; folded: boolean } // total: before the pickers
  | { kind: 'group'; node: Group; children: Resolved[]; folded: boolean }
  | { kind: 'header'; node: Header; value: string }

export const countOf = (r: Resolved): number =>
  r.kind === 'header' ? 0 : r.kind === 'section' ? r.items.length : r.children.reduce((n, c) => n + countOf(c), 0)

export const quietOf = (r: Resolved): string[] =>
  r.kind === 'header' ? [] : r.kind === 'section' ? (r.total === 0 ? [r.node.quiet] : []) : r.children.flatMap(quietOf)

// headers always draw; a section once its source has something (a view that hides it all still shows the pill)
export const isShown = (r: Resolved): boolean =>
  r.kind === 'header' ? true : r.kind === 'section' ? r.total > 0 : r.children.some(isShown)
