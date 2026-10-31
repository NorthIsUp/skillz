import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Menu, Span } from '../types'
import { parseAnsi } from './ansi'
import { inView, layoutOf, menuFrom, moveBy, press, readLayout, writeLayout } from './layout'

const lines = atom({ plugin: 'cc-statusline', key: 'lines' } as const, [] as Span[][])
const menu = atom({ plugin: 'cc-statusline', key: 'menu' } as const, null as Menu | null)

const TICK_MS = 2000
const PANE = 'cc-statusline-config'
const COMMAND = 'statusline-config'

// Same lookup as cc-statusline's config_path().
async function configPath($: EngineInterface): Promise<string> {
  const xdg = await $.env.get('XDG_CONFIG_HOME')
  const base = xdg || `${(await $.env.get('HOME')) ?? ''}/.config`
  return `${base}/cc-statusbar/config.toml`
}

// A missing file reads as empty: writeLayout then starts one.
async function readConfig($: EngineInterface): Promise<string> {
  try {
    return await $.fs.read(await configPath($))
  } catch {
    return ''
  }
}


async function apply($: EngineInterface, height: number, change: (m: Menu) => Menu) {
  const before = (await read($, menu)) ?? menuFrom(readLayout(await readConfig($)))
  const after = inView(change(before), height)
  if (after === before) return
  await update($, menu, () => after)
  if (after.rows === before.rows) return
  // Every change saves at once, so the band shows it on the next tick.
  try {
    await $.fs.write(await configPath($), writeLayout(await readConfig($), layoutOf(after)))
  } catch (err) {
    $.ui.toast(`cc-statusline: could not save the layout (${String(err)})`)
  }
}

// $.session.model() is the id; the status line shows the display name.
export const displayName = (id: string) =>
  id
    .replace(/^claude-/, '')
    .replace(/-\d{8}$/, '')
    .replace(/\[.*\]$/, '')
    .replace(/^(\w)(\w*)-(.*)$/, (_, a: string, b: string, v: string) => `${a.toUpperCase()}${b} ${v.replace(/-/g, '.')}`)

export const register: Register = on => {
  // Only classic hook inputs carry these; the binary needs the transcript for chips.
  let transcript = ''
  let effort = ''
  let cols = 0
  let isRunning = false

  on('classic.*', ($, e, next) => {
    const base = e as { transcript_path?: unknown; effort?: { level?: unknown } }
    if (typeof base.transcript_path === 'string' && base.transcript_path) transcript = base.transcript_path
    if (typeof base.effort?.level === 'string') effort = base.effort.level
    return next(e)
  }).catch(($, e, next) => next(e))

  on('session.start', async ($, e, next) => {
    const refresh = async () => {
      if (isRunning) return
      isRunning = true
      try {
        const [id, cwd, model, usage] = await Promise.all([
          $.session.id(),
          $.session.cwd(),
          $.session.model(),
          $.session.usage(),
        ])
        const limit = (kind: string) => {
          const r = usage.rateLimits.find(l => l.kind === kind)
          return r && { used_percentage: r.percentUsed, resets_at: r.resetsAt }
        }
        const input = {
          session_id: id,
          transcript_path: transcript,
          workspace: { current_dir: cwd },
          model: { display_name: displayName(model) },
          context_window: { used_percentage: usage.context.percent },
          cost: {
            total_cost_usd: usage.cost?.usd ?? 0,
            total_duration_ms: Math.max(0, (await $.clock.now()) - usage.startedAt),
          },
          rate_limits: { five_hour: limit('five_hour'), seven_day: limit('seven_day') },
          effort_level: effort,
          cols,
        }
        const ran = await $.process.run(['cc-statusline'], {
          cwd,
          stdin: JSON.stringify(input),
          timeoutMs: 5000,
        })
        if (ran.exitCode === 0) {
          const parsed = ran.stdout.replace(/\n+$/, '').split('\n').map(parseAnsi)
          await update($, lines, () => parsed)
        }
      } finally {
        isRunning = false
      }
    }
    await $.command.register({
      name: COMMAND,
      description: 'Choose and order the status line sections',
    })
    $.clock.every(TICK_MS, () => void refresh())
    void refresh()
    return next(e)
  })

  // The menu's visible rows: the pane body less the hint line.
  let height = 10

  on('command.run', { command: COMMAND }, async $ => {
    const fresh = menuFrom(readLayout(await readConfig($)))
    await update($, menu, () => fresh)
    await $.ui.open({ id: PANE, title: 'Status line sections', focus: true, closeOnEscape: true })
    await $.ui.scroll({ in: PANE, to: { key: 'menu' }, block: 'start' })
    return { text: 'Status line sections opened.' }
  })

  // Client is terminal-only; it draws the rows and forwards keys after a click.
  on('ui.render', { component: 'Pane', requestId: PANE, surface: 'terminal' }, async ($, e) => {
    height = Math.max(1, e.props.scroll.bodyRows - 1)
    const { Box, Client, Text } = $.ui.resolve(e)
    const m = (await read($, menu)) ?? menuFrom(readLayout(await readConfig($)))
    // A blank row either side keeps the body scrollable both ways, so the
    // engine raises ui.scroll for the arrows; it only does when it can move.
    return (
      <Box flexDirection="column">
        <Text> </Text>
        <Client key="menu" module="./menu.tsx" props={{ ...inView(m, height), height }} />
        <Text> </Text>
      </Box>
    )
  })

  // The person's arrows, wheel and page keys move the cursor; the window stays
  // pinned one row down, past the top pad. The mod's own pin scroll passes.
  on('ui.scroll', { requestId: PANE }, async ($, e, next) => {
    if (e.origin.kind !== 'person') return next(e)
    await apply($, height, m => moveBy(m, e.by))
    return next({ ...e, offset: 1 })
  })

  on('ui.message', async ($, e, next) => {
    const key = (e.data as { key?: unknown } | null)?.key
    if (e.requestId !== PANE || typeof key !== 'string') return next(e)
    await apply($, height, m => press(m, key))
    return {}
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    cols = e.props.bodyColumns
    const shown = await read($, lines)
    if (e.props.hasSurvey || shown.length === 0) return next(e)

    const { Box, Text, Link } = $.ui.resolve(e)
    const span = (s: Span, i: number) => {
      const { text, href, ...style } = s
      const t = (
        <Text key={String(i)} {...style}>
          {text}
        </Text>
      )
      return href ? <Link key={String(i)} href={href}>{t}</Link> : t
    }
    return (
      <Box flexDirection="column">
        {shown.map((line, i) => (
          <Text key={String(i)} wrap="truncate-end">
            {line.map(span)}
          </Text>
        ))}
      </Box>
    )
  })
}
