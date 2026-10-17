import type { ClientModule } from 'claude-code'

import { layoutOf, press, SPLIT } from './layout'
import type { Menu, Row } from './layout'

type Props = { rows: Row[] }

const MenuView: ClientModule<Props, Menu> = (props, surface) => {
  const { Box, Text } = surface.elements
  if (surface.state === undefined) {
    surface.onKey(({ key }) => {
      const before = surface.state ?? { rows: props.rows, cursor: 0 }
      const after = press(before, key)
      if (after === before) return
      surface.setState(after)
      if (after.rows !== before.rows) surface.post(layoutOf(after))
    })
    surface.setState({ rows: props.rows, cursor: 0 })
  }
  const { rows, cursor } = surface.state ?? { rows: props.rows, cursor: 0 }

  return (
    <Box flexDirection="column">
      {rows.map((row, i) => {
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
      <Text dimColor> </Text>
      <Text dimColor>↑↓ move · space/enter toggle · ←→ reorder · esc close</Text>
    </Box>
  )
}

export default MenuView
