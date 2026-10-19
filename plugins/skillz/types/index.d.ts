export type DecisionId = string

declare module 'claude-code' {
  interface McpToolInputs {
    'mcp__skillz__vf_set': { id: DecisionId; enabled: boolean }
  }
  interface PluginState {
    'skillz': { vfOff: DecisionId[] }
  }
}
