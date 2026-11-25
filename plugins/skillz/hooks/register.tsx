import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Ask } from '../types'

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
const ASK_TOOL = 'mcp__skillz__ask'
const pending = atom({ plugin: 'skillz', key: 'ask' } as const, null)

export const answers = (ask: Ask, text: string) =>
  ask.options.some(o => new RegExp(`(^|[^A-Za-z0-9.])${o.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Za-z0-9.]|$)`).test(text))

export const askBlock = (ask: Ask) =>
  [
    '╭────────────────────────────────────────',
    `│  ❓ ${ask.question}`,
    '│',
    ...ask.options.map(o => `│  ${o.id}${o.recommended ? ' ⭐' : ''}  ${o.label}${o.detail ? ` ..... ${o.detail}` : ''}`),
    '╰────────────────────────────────────────',
    `say ${ask.options.map(o => `**${o.id}**`).join(' or ')}`,
  ].join('\n')

const setEnabled = async ($: EngineInterface, id: string, enabled: boolean) => {
  const next = await update($, off, list => (enabled ? list.filter(x => x !== id) : list.includes(id) ? list : [...list, id]))
  await $.store.set(STORE_KEY, next)
  return next
}

export const checklist = (ids: readonly string[]) =>
  DECISIONS.map((d, i) => `${i + 1}. ${ids.includes(d.id) ? '[ ]' : '[x]'} ${d.label}`).join('\n')

// An update deletes the cache folder this copy loaded from, and the skills,
// agents and hooks read from it vanish mid-session. This module stays in
// memory, so it reloads the plugins onto the new folder. Detached, as in
// /skillz-update: $.command.run is refused from inside the hook that called
// it, and the reload waits for an idle session, which a prompt hook never is.
const reloadQueued = atom({ plugin: 'skillz', key: 'isReloadQueued' } as const, false)
async function reloadIfOrphaned($: EngineInterface) {
  if ((await read($, reloadQueued)) || (await $.fs.exists($.plugin.root))) return
  await update($, reloadQueued, () => true)
  void (async () => {
    await $.clock.sleep(0)
    await $.command.run({ command: 'reload-plugins', args: '' })
  })()
}

export const register: Register = (on, options) => {
  // Opt-in: off, only /skillz-update loads and the skill falls back to chat text.
  const vf = options.visualFormattingModule === true

  on('session.start', async ($, e, next) => {
    // Backstop for a session left idle across an update.
    $.clock.every(60 * 60_000, () => reloadIfOrphaned($))
    await $.command.register({ name: 'skillz-update', description: 'Update skillz plugins, then reload plugins and skills' })
    if (!vf) return next(e)
    const saved = await $.store.get(STORE_KEY)
    if (Array.isArray(saved)) await update($, off, () => saved.filter(x => typeof x === 'string'))
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
    await $.tool.register({
      name: 'ask',
      isDeferred: false,
      description:
        'Pin a question with labeled options above the user\'s prompt until they answer; picking one sends its id as their reply. Call it whenever a reply ends asking the user to pick (the question block of the visual-formatting rule), with the same ids. Returns the block as text: also print it as the last thing in your reply, then end your turn.',
      inputSchema: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          options: {
            type: 'array',
            minItems: 2,
            maxItems: 9,
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'globally unique option id, e.g. G1' },
                label: { type: 'string', description: 'who acts (Agent/User) and what happens' },
                detail: { type: 'string', description: 'cost or tradeoff' },
                recommended: { type: 'boolean' },
              },
              required: ['id', 'label'],
            },
          },
        },
        required: ['question', 'options'],
      },
    })
    await $.command.register({ name: 'vf', description: 'Toggle visual-formatting decisions' })
    return next(e)
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
      // Without a scope it updates only the install for this directory, so the user-scope copy every other project falls back to went stale.
      const u = await $.process.run(['claude', 'plugin', 'update', `${p}@${MARKETPLACE}`, '--scope', 'user'], minutes)
      lines.push(`${p} (user): ${lastLine(u.stdout || u.stderr)}`)
    }
    // $.command.run is refused from inside this hook, so the reloads start once it has answered.
    void (async () => {
      await $.clock.sleep(0)
      await $.command.run({ command: 'reload-skills', args: '' })
      // Last: reloading plugins unloads this module, ending this chain.
      await $.command.run({ command: 'reload-plugins', args: '' })
    })().catch((err: unknown) => $.ui.toast(`skillz: reload failed, run /reload-plugins and /reload-skills (${String(err)})`))

    return { text: [...lines, 'Reloading plugins and skills…'].join('\n') }
  })

  // One prompt hook, so it runs with the visual-formatting module off too: the
  // folder check always, and the pinned question (sticky: only a message
  // naming one of its option ids answers it) when the module is on.
  on('prompt.submit', async ($, e, next) => {
    await reloadIfOrphaned($)
    const ask = vf ? await read($, pending) : null
    if (ask && answers(ask, e.text)) await update($, pending, () => null)
    return next(e)
  })

  if (!vf) return

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

  on('tool.call', { tool: ASK_TOOL }, async ($, e) => {
    const options = Array.isArray(e.options) ? e.options.filter(o => typeof o?.id === 'string' && typeof o?.label === 'string') : []
    if (typeof e.question !== 'string' || options.length < 2) return { deny: 'need a question and at least two options with id and label' }
    const ask: Ask = { question: e.question, options }
    await update($, pending, () => ask)
    return { result: askBlock(ask) }
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
    const ask = await read($, pending)
    if (e.props.hasSurvey || !ask) return below
    const { Box, Text, Button } = $.ui.resolve(e)
    // ctrl+x tab lands on the question, not on whatever else is in the band.
    const focused = ask.options.find(o => o.recommended) ?? ask.options[0]

    return (
      <Box flexDirection="column">
        {below}
        <Box flexDirection="column" borderStyle="round" paddingX={1}>
          <Box>
            <Text bold>❓ {ask.question} </Text>
            <Button key="ask-dismiss" plain role="dismiss" onPress={() => update($, pending, () => null)}>
              ✕
            </Button>
          </Box>
          {ask.options.map(o => (
            <Button
              key={`ask-${o.id}`}
              plain
              {...(o === focused && { autoFocus: true as const })}
              onPress={async () => {
                await update($, pending, () => null)
                await $.prompt.submit({ text: o.id, asUser: true })
              }}>
              {o.id}
              {o.recommended ? ' ⭐' : ''} {o.label}
              {o.detail ? <Text dimColor> ..... {o.detail}</Text> : ''}
            </Button>
          ))}
          <Text dimColor>ctrl+x tab, arrows, Enter</Text>
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
