import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Span } from '../types'
import { parseAnsi } from './ansi'
import { menuFrom, readLayout, writeLayout } from './layout'
import type { Layout } from './layout'

const lines = atom({ plugin: 'cc-statusline', key: 'lines' } as const, [] as Span[][])

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

const isLayout = (v: unknown): v is Layout => {
  const names = (x: unknown) => Array.isArray(x) && x.every(n => typeof n === 'string')
  return typeof v === 'object' && v !== null && names((v as Layout).left) && names((v as Layout).right)
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

  on('command.run', { command: COMMAND }, async $ => {
    await $.ui.open({ id: PANE, title: 'Status line sections', focus: true, closeOnEscape: true })
    await $.ui.focus({ requestId: PANE, key: 'menu' })
    return { text: 'Status line sections opened.' }
  })

  // Client, the one element that takes raw arrow keys, is terminal-only.
  on('ui.render', { component: 'Pane', requestId: PANE, surface: 'terminal' }, async ($, e) => {
    const { Box, Client } = $.ui.resolve(e)
    const { rows } = menuFrom(readLayout(await readConfig($)))
    return (
      <Box flexDirection="column">
        <Client key="menu" module="./menu.tsx" props={{ rows }} />
      </Box>
    )
  })

  // Every change saves at once, so the band shows it on the next tick.
  on('ui.message', async ($, e, next) => {
    if (e.requestId !== PANE || !isLayout(e.data)) return next(e)
    try {
      await $.fs.write(await configPath($), writeLayout(await readConfig($), e.data))
    } catch (err) {
      $.ui.toast(`cc-statusline: could not save the layout (${String(err)})`)
    }
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
