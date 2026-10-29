import type { RenderSurface } from 'claude-code'

import type { Ctx } from './model'

// everything that differs by surface is decided here, once per draw; register.tsx hands in $.ui.resolve(e)
export function makeCtx(table: Ctx['ui'], e: { surface: RenderSurface; viewport?: { columns: number; rows: number } }): Ctx {
  // the terminal has no Svg; desktop, vscode and mobile draw it with SMIL
  const svg = e.surface !== 'terminal'
  let pressed = 0
  return {
    ui: { ...table, Svg: svg ? table.Svg : undefined },
    surface: e.surface,
    can: { svg },
    size: {
      columns: e.viewport?.columns ?? 60,
      // viewport rows is the whole window; leave room for the pane's title bar
      fillRows: e.viewport ? Math.max(0, e.viewport.rows - 6) : undefined,
    },
    // numbered in draw order across the whole pane, so hotkeys stay unique inside groups
    hotkey: () => (++pressed <= 9 ? String(pressed) : undefined),
  }
}
