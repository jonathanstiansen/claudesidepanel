import type { AgentRow } from '../../types'

type Listed = { id: string; description: string; type: string; status: string; name?: string }

// the engine drops finished agents from its list, so rows merge by id and keep their last status
export const mergeAgents = (list: AgentRow[], listed: Listed[]): AgentRow[] => {
  const rows: AgentRow[] = listed.map(a => ({ id: a.id, description: a.description, type: a.type, status: a.status, ...(a.name && { name: a.name }) }))
  return [...list.map(o => rows.find(r => r.id === o.id) ?? o), ...rows.filter(r => !list.some(o => o.id === r.id))]
}
