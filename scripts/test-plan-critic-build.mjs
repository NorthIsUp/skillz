#!/usr/bin/env node
// Self-check for the plan-critic-build templates' resume logic. Run: mise run test-plan-critic-build
// Runs the real templates with stubbed agents; only the ledger agent is real (it runs its shell command),
// so the ledger snapshot, done/hint derivation and INCOMPLETE status are exercised end to end.
import { execSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const T = join(dirname(fileURLToPath(import.meta.url)), '../plugins/skillz/skills/plan-critic-build/templates')
const AsyncFunction = (async () => {}).constructor
const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null', GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' }
const sh = (cmd, cwd) => execSync(cmd, { cwd, env, shell: '/bin/bash', stdio: ['ignore', 'pipe', 'pipe'] }).toString()

let pass = 0, fail = 0
function check(label, ok, detail = '') {
  if (ok) { pass++; console.log(`  ok   ${label}`) } else { fail++; console.log(`  FAIL ${label} ${detail}`) }
}

const compile = path => new AsyncFunction('agent', 'parallel', 'phase', 'log', 'args', 'workflow',
  readFileSync(path, 'utf8').replace(/^export const meta/m, 'const meta'))

// reply(label, prompt) plays every agent except the ledger snapshot, which really runs.
async function run(template, args, reply) {
  const calls = []
  async function agent(prompt, opts = {}) {
    calls.push({ label: opts.label, prompt })
    if (opts.label === 'ledger') return sh(prompt.split('\n')[1])
    return reply(opts.label, prompt)
  }
  const parallel = thunks => Promise.all(thunks.map(t => t().catch(() => null)))
  const nested = () => { throw new Error('workflow() nesting is one level only') }
  const workflow = ({ scriptPath }, a) => compile(scriptPath)(agent, parallel, () => {}, () => {}, a, nested)
  const result = await compile(join(T, template))(agent, parallel, () => {}, () => {}, args, workflow)
  const prompt = label => (calls.find(c => c.label === label) || {}).prompt || ''
  return { result, labels: calls.map(c => c.label).filter(l => l !== 'ledger'), prompt }
}

function fixture() {
  const d = mkdtempSync(join(tmpdir(), 'pcb-'))
  const repo = join(d, 'repo')
  mkdirSync(join(repo, 'docs/run'), { recursive: true })
  sh('git init -q -b main && git commit -q --allow-empty -m init', repo)
  return { d, repo, ledger: join(repo, 'docs/run'), scratch: join(d, 'scratch') }
}
const entry = (f, kind, id, result) => writeFileSync(join(f.ledger, `${kind}-${id}.json`), JSON.stringify({ kind, id, result }))
const mergeTask = (repo, id) => sh(`git checkout -q -b task/${id} && git commit -q --allow-empty -m ${id} && git checkout -q main && git merge -q --no-ff task/${id} -m "merge: ${id}"`, repo)

const researchResult = k => ({ doc_path: `docs/research/${k}.md`, summary: `${k} summary`, confidence: 'high', open_questions: [] })
const sectionResult = id => ({ path: `docs/plan/${id}.md`, tasks: [{ id: `${id}-T1`, title: 't', files: [], depends_on: [] }], produces: [], consumes: [], contract_additions: [], risks: [] })
const graph = { fixes_applied: [], spec_changes: [], remaining_gaps: [], tasks: [], waves: [], hot_files: [] }

console.log('plan-critic: relaunch after a usage-limit stop')
{
  const f = fixture()
  entry(f, 'research', 'r1', researchResult('r1'))
  entry(f, 'research', 'r2', researchResult('r2'))
  entry(f, 'section', 's0', sectionResult('s0'))
  mkdirSync(join(f.scratch, 's2'), { recursive: true })
  const args = {
    repo: f.repo, ledger: f.ledger, scratch: f.scratch, mergeLock: join(f.d, 'merge.lock'), trailer: 'Co-Authored-By: x',
    spec: 'spec.md', plan: 'plan.md', sectionsDir: join(f.repo, 'docs/plan'), researchDir: join(f.repo, 'docs/research'), writingPlans: 'wp.md', context: '',
    research: ['r1', 'r2', 'r3'].map(key => ({ key, title: key, ask: key })),
    sections: [{ id: 's0', scope: 's0', needs: ['r1'] }, { id: 's1', scope: 's1', needs: ['r3'], dependsOn: ['s0'] }, { id: 's2', scope: 's2', needs: ['r2'] }],
  }
  const reply = failS1 => label => label.startsWith('research:') ? researchResult(label.slice(9))
    : label === 'write:s1' && failS1 ? null
      : label.startsWith('write:') ? sectionResult(label.slice(6)) : graph

  let r = await run('plan-critic.workflow.js', args, reply(true))
  check('only unfinished agents launch', JSON.stringify(r.labels) === JSON.stringify(['research:r3', 'write:s2', 'write:s1']), JSON.stringify(r.labels))
  check('leftover prototype becomes the hint', r.prompt('write:s2').includes(`prototype is at "${f.scratch}/s2"`))
  check('no hint without a prototype', !r.prompt('write:s1').includes('interrupted'))
  check('agents commit their ledger entry', r.prompt('research:r3').includes('research-r3.json') && r.prompt('research:r3').includes('git commit'))
  check('failed planner => INCOMPLETE, critic skipped', r.result.status === 'INCOMPLETE' && !r.labels.includes('critic'))
  check('resume names exactly what is missing', JSON.stringify(r.result.resume.missing) === JSON.stringify({ research: [], sections: ['s1'], critic: true }), JSON.stringify(r.result.resume.missing))

  // The agents that finished wrote their entries; relaunch with the same args.
  entry(f, 'research', 'r3', researchResult('r3'))
  entry(f, 'section', 's2', sectionResult('s2'))
  r = await run('plan-critic.workflow.js', args, reply(false))
  check('relaunch runs only the lost planner and the critic', JSON.stringify(r.labels) === JSON.stringify(['write:s1', 'critic']), JSON.stringify(r.labels))
  check('relaunch completes', r.result.status === 'complete')

  entry(f, 'section', 's1', sectionResult('s1'))
  entry(f, 'critic', 'graph', graph)
  r = await run('plan-critic.workflow.js', args, reply(false))
  check('fully recorded run launches nothing', r.labels.length === 0 && r.result.status === 'complete', JSON.stringify(r.labels))
}

const impl = { status: 'done', branch: 'b', worktree: 'w', commits: [], evidence: [], deviations: [], concerns: [] }
const final = { suites: [], features: [], evidence_viewed: [], fixes: [], gaps: [] }
const buildReply = failing => label => label === `review:${failing}` ? null
  : label.startsWith('impl:') ? impl : label.startsWith('review:') ? { merged: true, issues_fixed: [], open_concerns: [] } : final

console.log('wave-build: merged tasks come from the branch')
{
  const f = fixture()
  mergeTask(f.repo, 'T1')
  const args = {
    repo: f.repo, ledger: f.ledger, worktrees: join(f.d, 'wt'), branch: 'main', mergeLock: join(f.d, 'merge.lock'), trailer: 'x',
    plan: 'plan.md', spec: 'spec.md', rules: '', final: 'run tests',
    tasks: ['T1', 'T2', 'T3'].map(id => ({ id, file: 'p.md' })), waves: [['T1', 'T2'], ['T3']],
  }
  let r = await run('wave-build.workflow.js', args, buildReply('T3'))
  check('merged task skipped', !r.labels.includes('impl:T1') && r.labels.includes('impl:T2'), JSON.stringify(r.labels))
  check('merge commit carries the PROGRESS line', r.prompt('review:T2').includes('merge: T2') && r.prompt('review:T2').includes('PROGRESS.md'))
  check('failed wave => INCOMPLETE with T3 not run', r.result.status === 'INCOMPLETE' && r.result.not_run.includes('T3'), JSON.stringify(r.result.not_run))

  mergeTask(f.repo, 'T2')
  r = await run('wave-build.workflow.js', args, buildReply(null))
  check('relaunch runs only T3, then final', JSON.stringify(r.labels) === JSON.stringify(['impl:T3', 'review:T3', 'final-verify']), JSON.stringify(r.labels))
  check('relaunch completes', r.result.status === 'complete')
}

console.log('all-in-one: ledger plans, scratch hints, nested build')
{
  const f = fixture()
  mergeTask(f.repo, 'a1-T1')
  const planResult = id => ({ path: `docs/plan/${id}.md`, tasks: [], produces: [], consumes: [], risks: [] })
  entry(f, 'plan', 'a1', planResult('a1'))
  mkdirSync(join(f.scratch, 'a2'), { recursive: true })
  const args = {
    repo: f.repo, ledger: f.ledger, scratch: f.scratch, worktrees: join(f.d, 'wt'), branch: 'main', mergeLock: join(f.d, 'merge.lock'), trailer: 'x',
    plan: 'plan.md', spec: 'spec.md', planDir: join(f.repo, 'docs/plan'), writingPlans: 'wp.md', rules: '', final: 'run tests',
    waveBuild: join(T, 'wave-build.workflow.js'),
    chunks: [{ id: 'a1', slug: 'one', brief: '' }, { id: 'a2', slug: 'two', brief: '', needs: ['a1'] }],
  }
  const aioGraph = { fixes_applied: [], remaining_gaps: [], tasks: [{ id: 'a1-T1', file: 'p.md', depends_on: [] }, { id: 'a2-T1', file: 'p.md', depends_on: [] }], waves: [['a1-T1', 'a2-T1']] }
  const reply = failA2 => label => label === 'plan:a2' ? (failA2 ? null : planResult('a2')) : label === 'critic' ? aioGraph : buildReply(null)(label)

  let r = await run('all-in-one.workflow.js', args, reply(true))
  check('only the missing chunk plans, with its hint', JSON.stringify(r.labels) === JSON.stringify(['plan:a2']) && r.prompt('plan:a2').includes(`prototype is at "${f.scratch}/a2"`), JSON.stringify(r.labels))
  check('failed chunk => INCOMPLETE', r.result.status === 'INCOMPLETE')

  r = await run('all-in-one.workflow.js', args, reply(false))
  check('nested build skips merged task and re-reads nothing', JSON.stringify(r.labels) === JSON.stringify(['plan:a2', 'critic', 'impl:a2-T1', 'review:a2-T1', 'final-verify']), JSON.stringify(r.labels))
  check('complete', r.result.status === 'complete', JSON.stringify(r.result.status))
}

console.log(`${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
