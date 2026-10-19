import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

const PANE = 'vf'
const STORE_KEY = 'vfOff'
const off = atom({ plugin: 'skillz', key: 'vfOff' } as const, [])

export const DECISIONS = [
  { id: 'emoji', label: 'Emoji anchors', rule: 'emoji anchors on concepts or status lines' },
  { id: 'boxes', label: 'L1/L2/L3 boxed headers', rule: 'box-drawing headers (╔ ┏ ┌ or borderless ══ ━━ ──)' },
  { id: 'dashboard', label: 'Status-bucket dashboards', rule: 'goal/bucket dashboards with dot leaders' },
  { id: 'question', label: 'Rounded question block', rule: 'the rounded ╭ │ ╰ question block; ask inline instead' },
  { id: 'summary', label: 'Completion summary box', rule: 'a boxed completion summary; one plain line instead' },
  { id: 'merged', label: '"PR merged" block', rule: 'the 🚢 "PR merged" block' },
  { id: 'done', label: '"We done here" banner', rule: 'the ▛▀ "WE DONE HERE" banner' },
  { id: 'copy', label: 'Copy-to-clipboard links', rule: 'pbcopy:// copy links after snippets' },
] as const

export const overrides = (ids: readonly string[]) => {
  const dropped = DECISIONS.filter(d => ids.includes(d.id))
  if (dropped.length === 0) return undefined
  return [
    'The user switched off these visual-formatting decisions (this overrides the visual-formatting and copy-link rules):',
    ...dropped.map(d => `- do not use ${d.rule}`),
  ].join('\n')
}

export const checklist = (ids: readonly string[]) =>
  DECISIONS.map((d, i) => `${i + 1}. ${ids.includes(d.id) ? '[ ]' : '[x]'} ${d.label}`).join('\n')

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const saved = await $.store.get(STORE_KEY)
    if (Array.isArray(saved)) await update($, off, () => saved.filter(x => typeof x === 'string'))
    await $.command.register({ name: 'vf', description: 'Toggle visual-formatting decisions' })
    return next(e)
  })

  on('command.run', { command: 'vf' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Visual formatting', focus: true, closeOnEscape: true })
    // shortcut: chat text is read-only, toggling happens in the pane; drop once the pane is trusted
    return { text: `Visual formatting (toggle in the pane):\n${checklist(await read($, off))}` }
  })

  on('prompt.compose', async ($, e, next) => {
    const result = await next(e)
    const text = overrides(await read($, off))
    if (!text) return result
    return { sections: [...result.sections, { id: 'skillz:vf-overrides', text, scope: 'session' }] }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const ids = await read($, off)
    const toggle = (id: string) => async () => {
      const next = await update($, off, list => (list.includes(id) ? list.filter(x => x !== id) : [...list, id]))
      await $.store.set(STORE_KEY, next)
    }

    return (
      <Box flexDirection="column">
        <Text dimColor>Unchecked = Claude stops doing it. Saved across sessions.</Text>
        {DECISIONS.map((d, i) => (
          <Button key={d.id} plain hotkey={String(i + 1)} onPress={toggle(d.id)}>
            {ids.includes(d.id) ? '[ ]' : '[x]'} {d.label}
          </Button>
        ))}
      </Box>
    )
  })
}
