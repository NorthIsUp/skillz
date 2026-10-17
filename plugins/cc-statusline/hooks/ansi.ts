import type { Span } from '../types'

const NAMES: readonly string[] = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white']
const CUBE = [0, 95, 135, 175, 215, 255]

const hex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')

// 0-15 stay names so they follow the terminal's palette.
function color256(n: number): string {
  if (n < 8) return NAMES[n]!
  if (n < 16) return NAMES[n - 8]! + 'Bright'
  if (n < 232) {
    const i = n - 16
    return hex(CUBE[Math.floor(i / 36)]!, CUBE[Math.floor(i / 6) % 6]!, CUBE[i % 6]!)
  }
  const g = 8 + 10 * (n - 232)
  return hex(g, g, g)
}

type Style = Omit<Span, 'text'>

function applySgr(style: Style, params: number[]): Style {
  const s = { ...style }
  for (let i = 0; i < params.length; i++) {
    const p = params[i]!
    if (p === 0) {
      for (const k of Object.keys(s) as (keyof Style)[]) if (k !== 'href') delete s[k]
    } else if (p === 1) s.bold = true
    else if (p === 2) s.dimColor = true
    else if (p === 22) (delete s.bold, delete s.dimColor)
    else if (p === 3) s.italic = true
    else if (p === 23) delete s.italic
    else if (p === 4) s.underline = true
    else if (p === 24) delete s.underline
    else if (p === 7) s.inverse = true
    else if (p === 27) delete s.inverse
    else if (p >= 30 && p <= 37) s.color = NAMES[p - 30]!
    else if (p >= 90 && p <= 97) s.color = NAMES[p - 90] + 'Bright'
    else if (p === 39) delete s.color
    else if (p >= 40 && p <= 47) s.backgroundColor = NAMES[p - 40]!
    else if (p >= 100 && p <= 107) s.backgroundColor = NAMES[p - 100] + 'Bright'
    else if (p === 49) delete s.backgroundColor
    else if (p === 38 || p === 48) {
      const key = p === 38 ? 'color' : 'backgroundColor'
      if (params[i + 1] === 5) {
        s[key] = color256(params[i + 2] ?? 0)
        i += 2
      } else if (params[i + 1] === 2) {
        s[key] = hex(params[i + 2] ?? 0, params[i + 3] ?? 0, params[i + 4] ?? 0)
        i += 4
      }
    }
  }
  return s
}

// SGR and OSC 8 become styled spans; every other escape is dropped, since a
// Text refuses control characters.
// eslint-disable-next-line no-control-regex
const TOKEN = /\x1b\[([0-9;]*)m|\x1b\]8;[^;]*;([^\x07\x1b]*)(?:\x07|\x1b\\)|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b\[[0-9;?]*[A-Za-z]|[\x00-\x1f\x7f]/g

export function parseAnsi(line: string): Span[] {
  const out: Span[] = []
  let style: Style = {}
  let last = 0
  const push = (text: string) => {
    if (text) out.push({ text, ...style })
  }
  for (const m of line.matchAll(TOKEN)) {
    push(line.slice(last, m.index))
    last = m.index + m[0].length
    if (m[1] !== undefined) {
      style = applySgr(style, m[1] === '' ? [0] : m[1].split(';').map(Number))
    } else if (m[2] !== undefined) {
      style = { ...style }
      if (m[2]) style.href = m[2]
      else delete style.href
    }
  }
  push(line.slice(last))
  return out
}
