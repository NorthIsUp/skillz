export type DecisionId = string

declare module 'claude-code' {
  interface PluginState {
    'skillz': { vfOff: DecisionId[] }
  }
}
