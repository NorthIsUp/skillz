import { expect, test } from 'claude-code/testing'

import { parseAnsi } from './ansi'
import { displayName } from './register'

test('SGR colors, dim, bold and OSC 8 links become spans', async () => {
  const line =
    '\x1b[2m~/src\x1b[0m \x1b]8;;https://github.com/o/r/pull/7\x1b\\\x1b[38;5;99m\x1b[1m#7\x1b[0m\x1b]8;;\x1b\\ \x1b[31mx'
  expect(parseAnsi(line)).toEqual([
    { text: '~/src', dimColor: true },
    { text: ' ' },
    { text: '#7', color: '#875fff', bold: true, href: 'https://github.com/o/r/pull/7' },
    { text: ' ' },
    { text: 'x', color: 'red' },
  ])
})

test('other escapes and control characters are dropped', async () => {
  expect(parseAnsi('\x1b]6;1;bg;*;default\x07a\x1b[2Kb\tc')).toEqual([
    { text: 'a' },
    { text: 'b' },
    { text: 'c' },
  ])
})

test('model ids read as display names', async () => {
  expect(displayName('claude-opus-5-5')).toBe('Opus 5.5')
  expect(displayName('claude-haiku-4-5-20251001')).toBe('Haiku 4.5')
  expect(displayName('claude-fable-5-1[1m]')).toBe('Fable 5.1')
})
