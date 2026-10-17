import { expect, test } from 'claude-code/testing'

import { layoutOf, menuFrom, press, readLayout, SPLIT, writeLayout } from './layout'

const CONFIG = `# top comment
gap_root = 1

[layout]
left = [
    "repo", "branch",   # trailing
    "chips"
]
right = ["model"]
gap = 2   # kept

[repo]      # priority = 20
left = ["not", "layout"]
`

test('reads multi-line arrays inside [layout] only', async () => {
  expect(readLayout(CONFIG)).toEqual({ left: ['repo', 'branch', 'chips'], right: ['model'] })
})

test('a missing [layout] or key falls back to the defaults', async () => {
  expect(readLayout('').left[0]).toBe('repo')
  expect(readLayout('[layout]\nright = ["x"]\n').right).toEqual(['x'])
})

test('writing replaces only layout left/right and keeps everything else', async () => {
  const out = writeLayout(CONFIG, { left: ['chips'], right: ['model', 'effort'] })
  expect(out).toBe(`# top comment
gap_root = 1

[layout]
left = ["chips"]
right = ["model", "effort"]
gap = 2   # kept

[repo]      # priority = 20
left = ["not", "layout"]
`)
  expect(readLayout(out)).toEqual({ left: ['chips'], right: ['model', 'effort'] })
})

test('writing adds [layout] when the file has none', async () => {
  expect(writeLayout('gap_root = 1', { left: ['a'], right: [] })).toBe(
    'gap_root = 1\n\n[layout]\nleft = ["a"]\nright = []\n',
  )
})

test('the menu round-trips a layout and lists unused sections unchecked', async () => {
  const menu = menuFrom({ left: ['repo'], right: ['model'] })
  expect(menu.rows.slice(0, 3)).toEqual([
    { name: 'repo', on: true },
    { name: SPLIT, on: true },
    { name: 'model', on: true },
  ])
  expect(menu.rows.find(r => r.name === 'chips')).toEqual({ name: 'chips', on: false })
  expect(layoutOf(menu)).toEqual({ left: ['repo'], right: ['model'] })
})

test('keys: arrows move, space/enter toggle, left/right reorder', async () => {
  let m = menuFrom({ left: ['a', 'b'], right: ['c'] })
  m = press(m, 'down')
  expect(m.cursor).toBe(1)
  m = press(m, ' ')
  expect(layoutOf(m)).toEqual({ left: ['a'], right: ['c'] })
  m = press(m, 'return')
  m = press(m, 'left')
  expect(layoutOf(m)).toEqual({ left: ['b', 'a'], right: ['c'] })
  expect(m.cursor).toBe(0)
  m = press(press(press(m, 'right'), 'right'), 'right')
  expect(layoutOf(m)).toEqual({ left: ['a'], right: ['c', 'b'] })
  expect(press(m, 'up').cursor).toBe(m.cursor - 1)
})

test('the split row cannot be unchecked, and edges do nothing', async () => {
  const m = { ...menuFrom({ left: [], right: [] }), cursor: 0 }
  expect(m.rows[0]!.name).toBe(SPLIT)
  expect(press(m, ' ')).toBe(m)
  expect(press(m, 'up')).toBe(m)
  expect(press(m, 'left')).toBe(m)
})
