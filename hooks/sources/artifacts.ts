import type { Artifact } from '../../types'

// what one Artifact tool call made: its url, maybe a new version, maybe a name (an update brings none)
export type Found = { url: string; label?: string; version?: number }

// the Artifact tool's answers when it makes or changes one, seen in real sessions:
//   Published /path/index.html at <url> (Version 2, …)           publish of a file
//   Created a new Artifact at <url> (version 1792…) from the type  made from a type, named by the input's title
//   Updated the Artifact at <url> (Version 4, …) with /path/x.html a later write to one
// Anything else (quickstart's templates, list, read, errors) is not something this session made.
const MADE = /^(?:Published (\/[^\n]+?) at|Created a new Artifact at|Updated the Artifact at) (https:\/\/claude\.ai\/(?:code\/)?artifact\/[\w-]+)(?: \(Version (\d+))?/

// an index.html is named by its folder, anything else by its file
const labelOf = (path: string) => {
  const parts = path.trim().split('/').filter(Boolean)
  const file = parts.at(-1) ?? path
  return file === 'index.html' && parts.length > 1 ? (parts.at(-2) as string) : file
}

export const artifactFromTool = (input: Record<string, unknown>, text: string): Found | undefined => {
  const m = text.trimStart().match(MADE)
  if (!m) return undefined
  const [, path, url, version] = m
  if (!url) throw new Error(`thread-refs: an Artifact answer matched without a url: ${text.slice(0, 120)}`)
  const title = typeof input.title === 'string' && input.title.trim() !== '' ? input.title.trim() : undefined
  const created = text.trimStart().startsWith('Created')
  const label = title ?? (path ? labelOf(path) : undefined)
  return { url, ...(label && { label }), ...(version ? { version: Number(version) } : created ? { version: 1 } : {}) }
}

// one row per artifact: a later write updates it in place and keeps its name; new rows go last
export const upsertArtifacts = (list: Artifact[], found: Found): Artifact[] =>
  list.some(o => o.url === found.url)
    ? list.map(o => (o.url === found.url ? { ...o, ...found, label: found.label ?? o.label } : o))
    : [...list, { ...found, label: found.label ?? (found.url.split('/').at(-1) as string) }]
