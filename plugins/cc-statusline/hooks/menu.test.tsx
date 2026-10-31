import { expect, test } from 'claude-code/testing'

const PANE = {
  component: 'Pane',
  requestId: 'cc-statusline-config',
  props: {
    title: 'Status line sections',
    isFocused: true,
    bodyColumns: 80,
    placement: 'inline',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const CONFIG = '[layout]\nleft = ["repo", "branch"]\nright = ["model"]\ngap = 2\n'

test('keys in the menu save the new order to config.toml', async ($, on) => {
  let file = CONFIG
  const writes: string[] = []
  on('env.get', ($, e) => ({ value: e.name === 'HOME' ? '/home/me' : undefined }))
  on('fs.read', () => ({ value: file }))
  on('fs.write', ($, e) => {
    expect(e.path).toBe('/home/me/.config/cc-statusbar/config.toml')
    file = e.text
    writes.push(e.text)
    return { value: undefined }
  })

  const ui = await $.ui.mount({ plugin: 'cc-statusline', surface: 'terminal', ...PANE })
  expect((await ui.find({ in: 'menu', text: /\[x\] repo/ }))?.text).toContain('❯')

  await ui.key({ key: 'down', in: 'menu' })
  await ui.key({ key: 'left', in: 'menu' })
  expect(writes.at(-1)).toBe('[layout]\nleft = ["branch", "repo"]\nright = ["model"]\ngap = 2\n')

  await ui.key({ key: ' ', in: 'menu' })
  expect(writes.at(-1)).toContain('left = ["repo"]')
  expect(await ui.find({ in: 'menu', text: /\[ \] branch/ })).toBeDefined()

  await ui.key({ key: 'up', in: 'menu' })
  expect(writes).toHaveLength(2)
  await ui.unmount()
})

