import { expect, mock, test } from 'claude-code/testing'

import { checklist } from './register'

const ARGS = { model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', outputStyle: null, tools: [], surfaces: [], traits: [] }

for (const surface of ['terminal', 'desktop'] as const) {
  test(`unchecking a box adds an override section (${surface})`, async ($, on) => {
    on('prompt.compose', async () => ({ sections: [] }))
    mock.store(on)
    expect((await $.prompt.compose(ARGS)).sections).toEqual([])

    const ui = await $.ui.mount({
      plugin: 'skillz',
      surface,
      component: 'Pane',
      requestId: 'vf',
      props: { title: 'Visual formatting', isFocused: true, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {} },
    })
    await ui.press({ key: 'done' })
    expect((await ui.find({ key: 'done' }))?.text).toContain('[ ]')

    const { sections } = await $.prompt.compose(ARGS)
    expect(sections[0]?.id).toBe('skillz:vf-overrides')
    expect(sections[0]?.text).toContain('WE DONE HERE')

    await ui.press({ key: 'done' })
    expect((await $.prompt.compose(ARGS)).sections).toEqual([])
  })
}

test('chat checklist marks unchecked decisions', () => {
  const text = checklist(['done'])
  expect(text).toContain('1. [x] Emoji anchors')
  expect(text).toContain('7. [ ] "We done here" banner')
})

test('skillz-update updates every plugin then queues both reloads', async ($, on) => {
  const argvs: string[][] = []
  const ran: string[] = []
  const toasts: string[] = []
  on('clock.sleep', async () => ({ value: undefined }))
  on('ui.toast', async (_$, e) => (toasts.push(JSON.stringify(e)), { value: undefined }))
  on('process.run', async (_$, e) => {
    argvs.push([...e.argv])
    return { value: { exitCode: 0, stdout: `ok ${e.argv.at(-1)}\n`, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('command.run', { command: 'reload-plugins' }, async (_$, e) => (ran.push(e.command), { text: '' }))
  on('command.run', { command: 'reload-skills' }, async (_$, e) => (ran.push(e.command), { text: '' }))

  const { text } = await $.command.run({
    command: 'skillz-update',
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 80 },
  })
  expect(argvs[0]).toEqual(['claude', 'plugin', 'marketplace', 'update', 'northisup-skillz'])
  expect(argvs).toHaveLength(4)
  expect(text).toContain('skillz: ok skillz@northisup-skillz')
  // the reloads run detached after the command answers
  for (let i = 0; i < 50 && ran.length < 2 && toasts.length === 0; i++) await Promise.resolve()
  expect(toasts).toEqual([])
  expect(ran).toEqual(['reload-plugins', 'reload-skills'])
})
