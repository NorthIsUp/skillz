import type { ClientModule } from 'claude-code'

import type { Menu } from '../types'
import { SPLIT } from './layout'

type Props = Menu & { height: number }

// Draws the hooks module's menu and hands every key back to it; the state
// lives there because the pane's own arrows reach it as `ui.scroll`.
const MenuView: ClientModule<Props, true> = (props, surface) => {
  const { Box, Text } = surface.elements
  if (surface.state === undefined) {
    surface.onKey(({ key }) => surface.post({ key }))
    surface.setState(true)
  }
  const { rows, cursor, offset, height } = props

  return (
    <Box flexDirection="column">
      {rows.slice(offset, offset + height).map((row, j) => {
        const i = offset + j
        const mark = i === cursor ? '❯ ' : '  '
        return row.name === SPLIT ? (
          <Text key={`r${i}`} dimColor={i !== cursor}>
            {mark}──── right side ────
          </Text>
        ) : (
          <Text key={`r${i}`} color={i === cursor ? 'suggestion' : undefined} dimColor={!row.on && i !== cursor}>
            {mark}
            {row.on ? '[x] ' : '[ ] '}
            {row.name}
          </Text>
        )
      })}
      <Text dimColor>↑↓ move · click, then space/enter toggle · ←→ reorder · esc close</Text>
    </Box>
  )
}

export default MenuView
