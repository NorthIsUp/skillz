export type Span = {
  text: string
  color?: string
  backgroundColor?: string
  bold?: boolean
  dimColor?: boolean
  italic?: boolean
  underline?: boolean
  inverse?: boolean
  href?: string
}

declare module 'claude-code' {
  interface PluginState {
    'cc-statusline': { lines: Span[][] }
  }
}
