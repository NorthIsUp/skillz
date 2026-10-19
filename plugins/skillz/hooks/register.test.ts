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
