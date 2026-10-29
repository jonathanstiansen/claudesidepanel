export type Ci = { state: 'pass' | 'fail' | 'pending'; failing: string[] }

export type Pr = { url: string; label: string; title?: string; state?: string; isDraft?: boolean; error?: string; ci?: Ci; linear?: string }

export type Artifact = { url: string; label: string; version?: number }

export type AgentRow = { id: string; description: string; type: string; status: string; name?: string }

declare module 'claude-code' {
  interface PluginState {
    'thread-refs': { prs: Pr[]; skills: string[]; plugins: string[]; agents: AgentRow[]; tick: number; notes: Record<string, string>; views: Record<string, string>; folded: Record<string, boolean>; artifacts: Artifact[] }
  }
}
