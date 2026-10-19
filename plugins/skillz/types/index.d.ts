export type DecisionId = string
export type AskOption = { id: string; label: string; detail?: string; recommended?: boolean }
export type Ask = { question: string; options: AskOption[] }

declare module 'claude-code' {
  interface McpToolInputs {
    'mcp__skillz__vf_set': { id: DecisionId; enabled: boolean }
    'mcp__skillz__ask': { question: string; options: AskOption[] }
  }
  interface PluginState {
    'skillz': { vfOff: DecisionId[]; ask: Ask | null }
  }
}
