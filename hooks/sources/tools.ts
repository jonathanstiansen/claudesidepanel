// pure: what a tool call says about the skills and plugins this thread used

export const pluginOf = (tool: string, skill?: string): string | undefined => {
  if (tool === 'Skill' && skill?.includes(':')) return skill.split(':')[0]
  if (tool.startsWith('mcp__')) return tool.split('__')[1]?.replace(/^plugin_/, '')
  return undefined
}

export const skillOf = (tool: string, skill?: string) => (tool === 'Skill' ? skill : undefined)

export const addUnique = (list: string[], value: string | undefined) => (!value || list.includes(value) ? list : [...list, value])
