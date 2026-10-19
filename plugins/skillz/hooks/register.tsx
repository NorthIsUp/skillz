import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

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

const MARKETPLACE = 'northisup-skillz'
const PLUGINS = ['skillz', 'tmux-session-resume', 'guarded-worktrees'] as const

const lastLine = (out: string) => out.trim().split('\n').at(-1) ?? ''

const VF_TOOL = 'mcp__skillz__vf_set'

const setEnabled = async ($: EngineInterface, id: string, enabled: boolean) => {
  const next = await update($, off, list => (enabled ? list.filter(x => x !== id) : list.includes(id) ? list : [...list, id]))
  await $.store.set(STORE_KEY, next)
  return next
}

export const checklist = (ids: readonly string[]) =>
  DECISIONS.map((d, i) => `${i + 1}. ${ids.includes(d.id) ? '[ ]' : '[x]'} ${d.label}`).join('\n')

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const saved = await $.store.get(STORE_KEY)
    if (Array.isArray(saved)) await update($, off, () => saved.filter(x => typeof x === 'string'))
    await $.command.register({ name: 'skillz-update', description: 'Update skillz plugins, then reload plugins and skills' })
    await $.tool.register({
      name: 'vf_set',
      isDeferred: false,
      description:
        'Switch a visual-formatting decision on or off for this user, saved across sessions. Call it when the user says they want more or less of one (e.g. "stop with the boxes", "bring back the done banner"), then follow the new setting. Returns the full checklist.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', enum: DECISIONS.map(d => d.id) },
          enabled: { type: 'boolean' },
        },
        required: ['id', 'enabled'],
      },
    })
    await $.command.register({ name: 'vf', description: 'Toggle visual-formatting decisions' })
    return next(e)
  })

  on('command.run', { command: 'vf' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Visual formatting', focus: true, closeOnEscape: true })
    // shortcut: chat text is read-only, toggling happens in the pane; drop once the pane is trusted
    return { text: `Visual formatting (toggle in the pane):\n${checklist(await read($, off))}` }
  })

  on('tool.call', { tool: VF_TOOL }, async ($, e) => {
    if (!DECISIONS.some(d => d.id === e.id) || typeof e.enabled !== 'boolean')
      return { deny: `unknown decision ${String(e.id)} or non-boolean enabled` }
    return { result: checklist(await setEnabled($, e.id, e.enabled)) }
  })

  // commands/update.md stays as the manual fallback for when this module isn't loaded.
  on('command.run', { command: 'skillz-update' }, async $ => {
    const minutes = { timeoutMs: 180_000 }
    const market = await $.process.run(['claude', 'plugin', 'marketplace', 'update', MARKETPLACE], minutes)
    if (market.exitCode !== 0) return { text: `Marketplace update failed:\n${lastLine(market.stderr || market.stdout)}` }

    const lines: string[] = []
    for (const p of PLUGINS) {
      const r = await $.process.run(['claude', 'plugin', 'update', `${p}@${MARKETPLACE}`], minutes)
      lines.push(`${p}: ${lastLine(r.stdout || r.stderr)}`)
    }
    // $.command.run is refused from inside this hook, so the reloads start once it has answered.
    void (async () => {
      await $.clock.sleep(0)
      await $.command.run({ command: 'reload-plugins', args: '' })
      await $.command.run({ command: 'reload-skills', args: '' })
    })().catch((err: unknown) => $.ui.toast(`skillz: reload failed, run /reload-plugins and /reload-skills (${String(err)})`))

    return { text: [...lines, 'Reloading plugins and skills…'].join('\n') }
  })

  on('prompt.compose', async ($, e, next) => {
    const result = await next(e)
    const text = overrides(await read($, off))
    if (!text) return result
    return { sections: [...result.sections, { id: 'skillz:vf-overrides', text, scope: 'session' }] }
  })

  // Composes with whatever else draws the band (cc-statusline) instead of replacing it.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const below = await next(e)
    if (e.props.hasSurvey) return below
    const { Box, Text, Button } = $.ui.resolve(e)
    const ids = await read($, off)

    return (
      <Box flexDirection="column">
        {below}
        <Box flexWrap="wrap">
          <Text dimColor>vf </Text>
          {DECISIONS.map(d => (
            <Button key={`band-${d.id}`} plain onPress={() => setEnabled($, d.id, ids.includes(d.id))}>
              {ids.includes(d.id) ? <Text dimColor strikethrough>{d.id}</Text> : d.id}{' '}
            </Button>
          ))}
        </Box>
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const ids = await read($, off)
    const toggle = (id: string) => () => setEnabled($, id, ids.includes(id))

    return (
      <Box flexDirection="column">
        <Text dimColor>Unchecked = Claude stops doing it. Saved across sessions. ctrl+x tab to focus, then 1-8.</Text>
        {DECISIONS.map((d, i) => (
          <Button key={d.id} plain hotkey={String(i + 1)} onPress={toggle(d.id)}>
            {ids.includes(d.id) ? '[ ]' : '[x]'} {d.label}
          </Button>
        ))}
      </Box>
    )
  })
}
