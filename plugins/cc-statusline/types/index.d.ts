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

export type Row = { name: string; on: boolean }
/** `offset` is the first row of the scrolled window the pane shows. */
export type Menu = { rows: Row[]; cursor: number; offset: number }

declare module 'claude-code' {
  interface PluginState {
    'cc-statusline': { lines: Span[][]; menu: Menu | null }
  }
}
