// The binary's `[layout] left/right` lists, and the menu that edits them.

export type Layout = { left: string[]; right: string[] }
export type Row = { name: string; on: boolean }
export type Menu = { rows: Row[]; cursor: number }

/** The row splitting left from right; it moves like any section. */
export const SPLIT = '|'

// Mirrors cc-statusline's config.rs defaults, plus the dotted quota buckets.
export const DEFAULT_LAYOUT: Layout = {
  left: ['repo', 'pr_icon', 'branch', 'pr_num', 'ci', 'review', 'comments', 'dirty', 'ahead', 'behind', 'ticket', 'chips'],
  right: ['burn', 'agents', 'quotas', 'ctx_bar', 'loc', 'model', 'effort', 'spinner'],
}
export const KNOWN = [
  ...DEFAULT_LAYOUT.left,
  ...DEFAULT_LAYOUT.right,
  'quotas.hourly',
  'quotas.weekly',
  'quotas.design',
  'quotas.sonnet',
]

const HEADER = /^\s*\[\s*layout\s*\]\s*(#.*)?$/
const TABLE = /^\s*\[/
const ASSIGN = /^\s*(left|right)\s*=/

/** Line span of the `[layout]` table, header included; null when absent. */
function section(lines: string[]): [number, number] | null {
  const start = lines.findIndex(l => HEADER.test(l))
  if (start < 0) return null
  let end = start + 1
  while (end < lines.length && !TABLE.test(lines[end]!)) end++
  return [start, end]
}

/** Each `left`/`right` assignment in the span: its key and [first, last] line. */
function assignments(lines: string[], from: number, to: number) {
  const out: { key: 'left' | 'right'; first: number; last: number }[] = []
  for (let i = from; i < to; i++) {
    const m = ASSIGN.exec(lines[i]!)
    if (!m) continue
    let depth = 0
    let last = i
    for (; last < to; last++) {
      const code = lines[last]!.replace(/"[^"]*"|#.*$/g, '')
      depth += (code.match(/\[/g)?.length ?? 0) - (code.match(/\]/g)?.length ?? 0)
      if (depth <= 0) break
    }
    out.push({ key: m[1] as 'left' | 'right', first: i, last: Math.min(last, to - 1) })
    i = last
  }
  return out
}

export function readLayout(toml: string): Layout {
  const lines = toml.split('\n')
  const span = section(lines)
  const got: Partial<Layout> = {}
  if (span) {
    for (const a of assignments(lines, span[0] + 1, span[1])) {
      const body = lines.slice(a.first, a.last + 1).join('\n').replace(/#.*$/gm, '')
      got[a.key] = [...body.matchAll(/"([^"]*)"/g)].map(m => m[1]!)
    }
  }
  return { left: got.left ?? DEFAULT_LAYOUT.left, right: got.right ?? DEFAULT_LAYOUT.right }
}

const list = (key: string, names: string[]) =>
  `${key} = [${names.map(n => JSON.stringify(n)).join(', ')}]`

/** `toml` with `[layout]`'s left/right replaced; every other line kept as is. */
export function writeLayout(toml: string, layout: Layout): string {
  const lines = toml.split('\n')
  const fresh = [list('left', layout.left), list('right', layout.right)]
  const span = section(lines)
  if (!span) {
    const sep = toml === '' || toml.endsWith('\n') ? '' : '\n'
    return `${toml}${sep}\n[layout]\n${fresh.join('\n')}\n`
  }
  const drop = new Set<number>()
  for (const a of assignments(lines, span[0] + 1, span[1])) {
    for (let i = a.first; i <= a.last; i++) drop.add(i)
  }
  const kept = lines.filter((_, i) => !drop.has(i))
  kept.splice(span[0] + 1, 0, ...fresh)
  return kept.join('\n')
}

export function menuFrom(layout: Layout): Menu {
  const listed = new Set([...layout.left, ...layout.right])
  const rows: Row[] = [
    ...layout.left.map(name => ({ name, on: true })),
    { name: SPLIT, on: true },
    ...layout.right.map(name => ({ name, on: true })),
    ...KNOWN.filter(n => !listed.has(n)).map(name => ({ name, on: false })),
  ]
  return { rows, cursor: 0 }
}

export function layoutOf(menu: Menu): Layout {
  const split = menu.rows.findIndex(r => r.name === SPLIT)
  const names = (rows: Row[]) => rows.filter(r => r.on).map(r => r.name)
  return { left: names(menu.rows.slice(0, split)), right: names(menu.rows.slice(split + 1)) }
}

/** The menu after one key; the same object when the key does nothing. */
export function press(menu: Menu, key: string): Menu {
  const { rows, cursor } = menu
  const row = rows[cursor]
  switch (key) {
    case 'up':
      return cursor > 0 ? { rows, cursor: cursor - 1 } : menu
    case 'down':
      return cursor < rows.length - 1 ? { rows, cursor: cursor + 1 } : menu
    case ' ':
    case 'return':
      if (!row || row.name === SPLIT) return menu
      return { rows: rows.map((r, i) => (i === cursor ? { ...r, on: !r.on } : r)), cursor }
    case 'left':
    case 'right': {
      const to = key === 'left' ? cursor - 1 : cursor + 1
      if (to < 0 || to >= rows.length) return menu
      const next = [...rows]
      ;[next[cursor], next[to]] = [next[to]!, next[cursor]!]
      return { rows: next, cursor: to }
    }
    default:
      return menu
  }
}
