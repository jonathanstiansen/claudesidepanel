import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Pr } from '../types'
import { stars } from './layers/stars'
import { foldIdOf, group, header, noteIdOf, openUrlOf, viewIdOf } from './model'
import type { Ctx, Layer, Node, Snapshot } from './model'
import { drawPane, PANE } from './pane'
import { agentSection } from './sections/agents'
import { artifactSection } from './sections/artifacts'
import { chipSection } from './sections/chips'
import { prSection } from './sections/prs'
import { mergeAgents } from './sources/agents'
import { artifactFromTool, upsertArtifacts } from './sources/artifacts'
import { findPrs, ghPrView, prFromGh, upsertPr } from './sources/prs'
import { addUnique, pluginOf, skillOf } from './sources/tools'
import { makeCtx } from './surface'

// ── what the pane shows ─────────────────────────────────────────────────────
// top to bottom; a group is a box of pills. Everything below this block is the shell.

const LAYOUT: Node[] = [
  header({ id: 'goal', label: 'GOAL:', placeholder: 'what is this thread for?', style: { borderColor: 'claude', labelColor: 'claude', borderStyle: 'double' } }),
  prSection({ id: 'prs', title: '🐙 PULL REQUESTS' }),
  artifactSection({ id: 'artifacts', title: '🎨 ARTIFACTS' }),
  agentSection({ id: 'agents', title: '🤖 SUB-AGENTS' }),
  group({
    id: 'tooling',
    title: '🧰 TOOLING',
    children: [
      chipSection({ id: 'skills', title: '🧠 SKILLS', quiet: 'skills', source: 'skills', glyph: '✨', color: 'suggestion' }),
      chipSection({ id: 'plugins', title: '🔌 PLUGINS · MCP', quiet: 'plugins', source: 'plugins', glyph: '🧩', color: 'permission' }),
    ],
  }),
]

// drawn back to front behind (desktop) or between (terminal) the pills
const LAYERS: Layer[] = [stars]

// ── the shell ───────────────────────────────────────────────────────────────
// The desktop's engine (2.1.295) only follows `$` into functions declared in this file, and only reads
// atoms made in a const of this file, so every read, write, gh call and timer lives here. The rest of
// hooks/ is pure: it parses, merges and draws plain data.

const prs = atom({ plugin: 'thread-refs', key: 'prs' } as const, [])
const skills = atom({ plugin: 'thread-refs', key: 'skills' } as const, [])
const plugins = atom({ plugin: 'thread-refs', key: 'plugins' } as const, [])
const agents = atom({ plugin: 'thread-refs', key: 'agents' } as const, [])
const tick = atom({ plugin: 'thread-refs', key: 'tick' } as const, 0)
const notes = atom({ plugin: 'thread-refs', key: 'notes' } as const, {})
const views = atom({ plugin: 'thread-refs', key: 'views' } as const, {})
const folded = atom({ plugin: 'thread-refs', key: 'folded' } as const, {})
const artifacts = atom({ plugin: 'thread-refs', key: 'artifacts' } as const, [])

const seen = new Set<string>()

// the installer's settings, read once per load (a change in /config reloads the module)
let linearWorkspace: string | undefined

function openPane($: EngineInterface) {
  return $.ui.open({ id: PANE, title: 'Thread refs' })
}

async function lookup($: EngineInterface, found: Pr) {
  let row: Pr | undefined
  try {
    row = prFromGh(found, await $.process.run(ghPrView(found.url)), linearWorkspace)
  } catch (err) {
    row = { ...found, error: err instanceof Error ? err.message : String(err) }
  }
  if (row) await update($, prs, list => upsertPr(list, row))
}

function notePrs($: EngineInterface, text: string) {
  for (const found of findPrs(text)) {
    if (seen.has(found.url)) continue
    seen.add(found.url)
    $.clock.after(0, () => void lookup($, found))
  }
}

// artifacts come from the Artifact tool's own calls: the input names them, the answer says what was made
async function noteArtifact($: EngineInterface, tool: string, input: Record<string, unknown>, text: string) {
  if (tool !== 'Artifact') return
  const found = artifactFromTool(input, text)
  if (found) await update($, artifacts, list => upsertArtifacts(list, found))
}

async function refreshOpen($: EngineInterface) {
  for (const pr of await read($, prs)) if (pr.state === 'OPEN') await lookup($, pr)
}

async function noteTool($: EngineInterface, tool: string, skill?: string) {
  await update($, skills, list => addUnique(list, skillOf(tool, skill)))
  await update($, plugins, list => addUnique(list, pluginOf(tool, skill)))
}

async function syncAgents($: EngineInterface) {
  const listed = await $.agent.list()
  if (listed.length > 0) await update($, agents, list => mergeAgents(list, listed))
}

// the one place the pane reads state: each read subscribes the drawing, so a write redraws it
async function snapshot($: EngineInterface, surface: Ctx['surface']): Promise<Snapshot> {
  const [prList, agentList, skillList, pluginList, noteMap, viewMap, foldMap, artifactList] = await Promise.all([
    read($, prs),
    read($, agents),
    read($, skills),
    read($, plugins),
    read($, notes),
    read($, views),
    read($, folded),
    read($, artifacts),
  ])
  // only the terminal reads the tick, so the desktop's SMIL starfield is never redrawn by it
  const frame = surface === 'terminal' ? await read($, tick) : 0
  return { prs: prList, agents: agentList, skills: skillList, plugins: pluginList, tick: frame, notes: noteMap, views: viewMap, folded: foldMap, artifacts: artifactList }
}

export const register: Register = (on, options) => {
  const workspace = options.linearWorkspace
  // unset is a real state (no links yet); anything set must be a name
  if (workspace !== undefined && typeof workspace !== 'string') throw new Error('thread-refs: linearWorkspace must be a string')
  linearWorkspace = workspace?.trim() || undefined

  // nothing is reset here: a reload reruns this, and wiping lists makes the pane flash and reorder
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'thread-refs', description: 'Show PRs, artifacts, skills and plugins of this thread' })
    for (const m of await $.session.messages()) {
      notePrs($, JSON.stringify(m))
      for (const use of m.toolUses) {
        await noteTool($, use.tool, use.input.skill as string | undefined)
        if (!use.isError) await noteArtifact($, use.tool, use.input, use.text ?? '')
      }
    }
    $.clock.every(5 * 60_000, () => void refreshOpen($))
    $.clock.every(5_000, () => void syncAgents($))
    $.clock.every(700, () => void update($, tick, n => n + 1))
    void openPane($)
    return next(e)
  })

  on('command.run', { command: 'thread-refs' }, async $ => {
    await openPane($)
    return { text: 'Thread refs pane opened.' }
  })

  // PRs are found live in three places besides session.append, which a plugin above this one can skip:
  // the prompt, every tool call (its fields and its answer), and the turn's answer.

  // session.start's open is "unasked" and stays undrawn under 144 columns; a prompt you entered counts as asked
  on('prompt.submit', async ($, e, next) => {
    if (findPrs(e.text).length > 0) void openPane($)
    notePrs($, e.text)
    return next(e)
  })

  // `answer` is the assistant's final visible text of the turn
  on('turn.complete', async ($, e, next) => {
    notePrs($, e.answer)
    return next(e)
  }).catch(($, e, next) => next(e))

  on('session.append', async ($, e, next) => {
    const stored = await next(e)
    notePrs($, JSON.stringify(e.message.content))
    return stored
  }).catch(($, e, next) => next(e))

  // also where artifacts are seen live: session.append can be skipped by a plugin above this one
  on('tool.call', async ($, e, next) => {
    await noteTool($, String(e.tool), e.tool === 'Skill' ? e.skill : undefined)
    const answered = await next(e)
    notePrs($, `${JSON.stringify(e)}\n${answered.text ?? ''}`)
    // the event carries the tool's own fields (title, file_path, url, …) at its top level
    if (!answered.deny && !answered.isError && answered.text) await noteArtifact($, String(e.tool), e as unknown as Record<string, unknown>, answered.text)
    return answered
  }).catch(($, e, next) => next(e))

  on('skill.prompt', async ($, e, next) => {
    await noteTool($, 'Skill', e.skill)
    return next(e)
  })

  // draws never hold `$`, so a press is answered here, found by its Button's key
  on('ui.press', { requestId: PANE }, async ($, e, next) => {
    const url = openUrlOf(e.element)
    if (url) void $.process.run(['open', url])
    const fold = foldIdOf(e.element)
    if (fold) await update($, folded, all => ({ ...all, [fold]: !all[fold] }))
    return next(e)
  })

  // saved on every edit, not only Enter: the terminal redraws for its stars, which would wipe unsaved typing
  on('ui.input', { requestId: PANE }, async ($, e, next) => {
    const id = noteIdOf(e.element)
    if (id) await update($, notes, all => ({ ...all, [id]: e.value }))
    return next(e)
  })

  on('ui.select', { requestId: PANE }, async ($, e, next) => {
    const id = viewIdOf(e.element)
    if (id) await update($, views, all => ({ ...all, [id]: e.value }))
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) =>
    drawPane(makeCtx($.ui.resolve(e) as Ctx['ui'], e), await snapshot($, e.surface), LAYOUT, LAYERS),
  )
}
