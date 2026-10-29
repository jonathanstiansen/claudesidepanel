import { group, header } from './model'
import type { Node } from './model'
import { agentSection } from './sections/agents'
import { artifactSection } from './sections/artifacts'
import { chipSection } from './sections/chips'
import { prSection } from './sections/prs'

// every section the pane can show, by the id the `sections` setting names it with
const SECTIONS: Record<string, () => Node> = {
  goal: () => header({ id: 'goal', label: 'GOAL:', placeholder: 'what is this thread for?', style: { borderColor: 'claude', labelColor: 'claude', borderStyle: 'double' } }),
  prs: () => prSection({ id: 'prs', title: '🐙 PULL REQUESTS' }),
  artifacts: () => artifactSection({ id: 'artifacts', title: '🎨 ARTIFACTS' }),
  agents: () => agentSection({ id: 'agents', title: '🤖 SUB-AGENTS' }),
  tooling: () =>
    group({
      id: 'tooling',
      title: '🧰 TOOLING',
      children: [
        chipSection({ id: 'skills', title: '🧠 SKILLS', quiet: 'skills', source: 'skills', glyph: '✨', color: 'suggestion' }),
        chipSection({ id: 'plugins', title: '🔌 PLUGINS · MCP', quiet: 'plugins', source: 'plugins', glyph: '🧩', color: 'permission' }),
      ],
    }),
}

export const DEFAULT_SECTIONS = 'goal,prs,artifacts,agents,tooling'

// "tooling,prs" → those sections, top to bottom; a section left out is not drawn
export const layoutOf = (spec: string): Node[] => {
  const ids = spec.split(',').map(s => s.trim()).filter(Boolean)
  return ids.map((id, i) => {
    const make = SECTIONS[id]
    if (!make) throw new Error(`thread-refs: unknown section "${id}" in the sections setting; use any of ${Object.keys(SECTIONS).join(', ')}`)
    if (ids.indexOf(id) !== i) throw new Error(`thread-refs: section "${id}" is listed twice in the sections setting`)
    return make()
  })
}
