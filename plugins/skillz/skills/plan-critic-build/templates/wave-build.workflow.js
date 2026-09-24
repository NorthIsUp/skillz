export const meta = {
  name: 'wave-build',
  description: 'Execute a plan wave by wave: each task implemented in its own worktree, then a reviewer re-runs its tests, fixes, and merges under a lock',
  whenToUse: 'After plan-critic produced an execution graph with waves of disjoint-file tasks',
  phases: [
    { title: 'Fold', detail: 'concurrent agent rewrites the plan tasks new observations affect; awaited before the first wave that needs it' },
    { title: 'Side jobs', detail: 'independent data jobs writing to scratch, alongside the build' },
    { title: 'Build', detail: 'per wave: implementer in a worktree, reviewer re-tests and merges; stop at the first failed wave' },
    { title: 'Final', detail: 'whole-project verification on the integration branch' },
  ],
}

// All project specifics arrive through `args`; nothing below names a project.
// {
//   repo:        '<abs repo path>',                     // the checkout that owns the integration branch
//   worktrees:   '<abs dir for task worktrees>',
//   branch:      'main',                                // integration branch, local; the orchestrator pushes / opens the PR
//   prefix:      'task/',                               // task branch prefix
//   plan:        '<abs master plan path>',
//   spec:        '<abs spec path>',
//   trailer:     'Co-Authored-By: <model> <noreply@anthropic.com>',
//   rules:       '<project rules every agent obeys: build/test/lint commands, hook runner, what never gets committed>',
//   setup:       '<extra shell run in each new worktree, e.g. ln -s "$REPO/vendor" vendor>',  // optional
//   tasks:       [{ id, file }],                        // from plan-critic's graph
//   waves:       [[id, ...], ...],                      // fixed when this run starts
//   done:        [id, ...],                             // already merged; skipped (inject after a stop)
//   mergeLock:   '/tmp/<proj>-merge.lock',
//   locks:       [{ name: 'shared-resource', path: '/tmp/<proj>-<resource>.lock', when: '<which commands need it>',
//                   staleMinutes: 40, busyPattern: '<pgrep -f pattern that means the holder is still working>' }],  // optional
//   briefing:    { toolkit: ['<path>  <fn(args) -> result>'], toolkitRecipe: '<how to rebuild the toolkit>',
//                  facts: ['<already verified>'], limits: ['<environment limit>'], toolchain: '<versions and style bar>' },  // optional
//   assets:      'vendor/',                             // optional; gitignored or copyrighted, symlinked into each worktree via `setup`
//   maxParallel: 4,                                     // optional; cap tasks per wave batch (RAM, heavy builds)
//   fold:        { prompt: '<what to fold into which plan files>', beforeWave: 7 },  // optional; 1-based wave that needs it
//   sideJobs:    [{ label, prompt }],                   // optional; independent jobs, scratch output only
//   final:       '<project steps: setup, every test suite, evidence to capture, spec feature inventory path>',  // required
// }
const A = args
if (!A.final) throw new Error('args.final is required: the run is not done until a final verification reports on the whole project')
const FILE = Object.fromEntries(A.tasks.map(t => [t.id, t.file]))
const DONE = new Set(A.done || [])
const prefix = A.prefix || 'task/'
const q = p => `"${p}"`
const slug = id => id.toLowerCase().replace(/[^a-z0-9]+/g, '-')
// Prepended to every prompt so agents stop rediscovering the toolkit, the facts and the environment's limits.
function briefing(b = {}) {
  const list = (title, xs) => xs && xs.length ? `${title}\n${xs.map(x => `  - ${x}`).join('\n')}` : ''
  return [
    list('Scratch toolkit (ready-made; use it, do not rewrite it):', b.toolkit),
    b.toolkitRecipe ? `If the toolkit is gone, rebuild it: ${b.toolkitRecipe}` : '',
    list('Already verified (do not re-derive):', b.facts),
    list('Environment limits:', b.limits),
    b.toolchain ? `Toolchain and style bar: ${b.toolchain}` : '',
  ].filter(Boolean).join('\n')
}
const repoNote = r => `(always quote paths${/\s/.test(r) ? '; this one contains a space' : ''})`

// mkdir is atomic, so the directory is the lock. A holder that died leaves it behind; after
// staleMinutes with nothing matching `busyPattern` still running, the next waiter clears it.
function locked(lock, cmd, staleMinutes, busyPattern) {
  const alive = busyPattern ? ` && ! pgrep -f ${q(busyPattern)} >/dev/null` : ''
  return `until mkdir ${lock} 2>/dev/null; do if [ -n "$(find ${lock} -maxdepth 0 -mmin +${staleMinutes})" ]${alive}; then rmdir ${lock}; fi; sleep 5; done; trap 'rmdir ${lock}' EXIT; ${cmd}`
}

const lockRules = (A.locks || []).map(l =>
  `- ${l.when} must hold the ${l.name} lock, in ONE bash invocation: ${locked(l.path, '<command>', l.staleMinutes || 40, l.busyPattern)}  Release it as soon as the command ends.`).join('\n')

const RULES = `
${A.rules}
Integration repo: ${q(A.repo)} ${repoNote(A.repo)}, branch ${A.branch}. Binding docs: master plan ${q(A.plan)} (Global Constraints, Shared Contracts, Execution Graph) and spec ${q(A.spec)}. If the master plan's Global Constraints changed since you last read them, the current text wins: it is how the orchestrator changes course mid-run.
Hard rules:
- Never git --no-verify, HK_SKIP_STEPS, SKIP= or a disabled hook step. A failing hook is a finding: fix the code, or the hook config if it is genuinely wrong, and say so.
- A checkbox step is done only when you hold its artifact: the test output you saw, the screenshot, response or output file you looked at. Never claim a pass you did not see.
- Batch verification: make every related edit first, then one build + lint pass and fix everything it reports. Parameterized tests over collections, not one test per item. One end-to-end run that covers every screen, endpoint or command the task touches and captures all their evidence.
${lockRules}
- Never kill a process you did not start in this task (no broad pkill/killall). Other runs share this machine.
${A.assets ? `- Never commit anything under ${A.assets} (gitignored; may be copyrighted) and never copy copyrighted text verbatim; paraphrase.\n` : ''}- Deviation rule: the plan's code was verified against stand-ins; real code on ${A.branch} may differ. Keep the plan's names and contracts, adapt mechanics to what is actually there, and report every deviation.
${briefing(A.briefing)}
`

const IMPL_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['done', 'blocked'] },
    branch: { type: 'string' },
    worktree: { type: 'string' },
    commits: { type: 'array', items: { type: 'string' } },
    evidence: { type: 'array', items: { type: 'string' }, description: 'each test/lint/capture step: command and key output line' },
    deviations: { type: 'array', items: { type: 'string' } },
    concerns: { type: 'array', items: { type: 'string' } },
    blocker: { type: 'string' },
  },
  required: ['status', 'branch', 'worktree', 'commits', 'evidence', 'deviations', 'concerns'],
}
const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    merged: { type: 'boolean' },
    merge_commit: { type: 'string' },
    issues_fixed: { type: 'array', items: { type: 'string' } },
    open_concerns: { type: 'array', items: { type: 'string' } },
    blocker: { type: 'string' },
  },
  required: ['merged', 'issues_fixed', 'open_concerns'],
}

const FOLD_SCHEMA = {
  type: 'object',
  properties: {
    changed: { type: 'array', items: { type: 'string' }, description: 'task id: what changed' },
    new_tasks: { type: 'array', items: { type: 'string' }, description: 'task ids added; this run will not execute them' },
  },
  required: ['changed', 'new_tasks'],
}
const FINAL_SCHEMA = {
  type: 'object',
  properties: {
    suites: { type: 'array', items: { type: 'object', properties: { command: { type: 'string' }, passed: { type: 'number' }, failed: { type: 'number' } }, required: ['command', 'passed', 'failed'] } },
    features: { type: 'array', items: { type: 'object', properties: { feature: { type: 'string' }, status: { type: 'string', enum: ['works', 'partial', 'missing'] }, where: { type: 'string', description: 'file:line' } }, required: ['feature', 'status', 'where'] } },
    evidence_viewed: { type: 'array', items: { type: 'string' }, description: 'paths of screenshots, responses or output files you actually looked at' },
    fixes: { type: 'array', items: { type: 'string' } },
    gaps: { type: 'array', items: { type: 'string' }, description: 'larger breakages or missing features left for the orchestrator, with file:line' },
  },
  required: ['suites', 'features', 'evidence_viewed', 'fixes', 'gaps'],
}

function implPrompt(id, attempt, prior) {
  const br = `${prefix}${slug(id)}`, wt = `${A.worktrees}/${slug(id)}`
  return `${RULES}
TASK: Implement plan task ${id} exactly as written in ${q(FILE[id])} (the "### Task ${id}" block; read it fully, plus that file's header and the master plan's Global Constraints and Contracts). Its dependencies are merged into ${A.branch}.
Setup, a fresh worktree from the current ${A.branch}:
  mkdir -p ${q(A.worktrees)} && git -C ${q(A.repo)} worktree remove --force ${q(wt)} 2>/dev/null; git -C ${q(A.repo)} branch -D ${br} 2>/dev/null; git -C ${q(A.repo)} worktree add ${q(wt)} -b ${br} ${A.branch}${A.setup ? ` && (cd ${q(wt)} && REPO=${q(A.repo)} && ${A.setup})` : ''}
Work only inside ${q(wt)}. Follow every step in order (TDD: watch the failing test fail for the stated reason, implement, watch it pass, hooks pass, commit with the plan's message ending in '${A.trailer}'). Do NOT merge; a reviewer does that. Do not dispatch subagents.
${attempt > 1 ? `This is retry #${attempt}. The previous attempt reported:\n${prior}\nThe worktree was recreated from ${A.branch}; start over and avoid that failure.` : ''}
If truly blocked (the plan contradicts reality beyond this task's scope), stop and return status "blocked" with the exact blocker, what you tried and the worktree state.`
}

function reviewPrompt(id, impl) {
  const br = `${prefix}${slug(id)}`, wt = `${A.worktrees}/${slug(id)}`
  const merge = locked(A.mergeLock, `cd ${q(A.repo)} && git merge --no-ff ${br} -m "merge: ${id}" -m "${A.trailer}"`, 30, `git merge --no-ff ${prefix}`)
  return `${RULES}
TASK: You are a fresh reviewer for plan task ${id} ("### Task ${id}" in ${q(FILE[id])}) on branch ${br} in ${q(wt)}. Review it, then merge it.
Implementer report: ${JSON.stringify(impl)}
1. Read the task block and the diff (git -C ${q(wt)} diff ${A.branch}...${br}). Check: every file, interface and test the task names exists with the exact names; contracts and Global Constraints hold; tests assert real behaviour, not tautologies; no scope creep; deviations are justified.
2. Re-run the task's test and lint commands yourself in the worktree (holding any lock the rules name). Look at every screenshot or output the task requires.
3. Fix real problems directly in the worktree: small focused commits with the trailer, hooks passing. Don't gold-plate.
4. Merge, holding the merge lock: ${merge}
   On conflict: git merge --abort, rebase the branch onto ${A.branch} in the worktree, resolve, re-run the task's tests, merge again. Never force anything onto ${A.branch}.
5. After a successful merge: git -C ${q(A.repo)} worktree remove --force ${q(wt)} && git -C ${q(A.repo)} branch -d ${br}
If the implementation is unfixably wrong or incomplete, do NOT merge; return merged=false with the blocker.`
}

async function runTask(id) {
  let impl = null, prior = ''
  for (let attempt = 1; attempt <= 2; attempt++) {
    impl = await agent(implPrompt(id, attempt, prior), { label: `impl:${id}${attempt > 1 ? ' (retry)' : ''}`, phase: 'Build', schema: IMPL_SCHEMA })
    if (impl && impl.status === 'done') break
    prior = impl ? `${impl.blocker || ''} | concerns: ${impl.concerns.join('; ')}` : 'agent died'
  }
  if (!impl || impl.status !== 'done') return { id, ok: false, stage: 'impl', detail: impl }
  const rev = await agent(reviewPrompt(id, impl), { label: `review:${id}`, phase: 'Build', schema: REVIEW_SCHEMA })
  if (!rev || !rev.merged) return { id, ok: false, stage: 'review', detail: rev, impl }
  return { id, ok: true, deviations: impl.deviations, concerns: [...impl.concerns, ...rev.open_concerns], fixed: rev.issues_fixed }
}

const scheduled = new Set(A.waves.flat())
const unscheduled = A.tasks.map(t => t.id).filter(id => !scheduled.has(id) && !DONE.has(id))
if (unscheduled.length) log(`In the graph but in no wave, so this run will not execute them: ${unscheduled.join(', ')}`)

// Fold and side jobs start now and run alongside the early waves.
const foldPromise = A.fold ? agent(`${RULES}
TASK: Fold new observations or research into the plan text before the affected tasks run. Do not implement anything.
${A.fold.prompt}
Keep each task's TDD structure with real code; update every test and golden the change affects; grep for every other reference to what you change. Add, never rename, contract members. Record any task you add in the master plan's Execution Graph.
Commit the doc edits to ${A.branch} holding the merge lock: ${locked(A.mergeLock, `cd ${q(A.repo)} && git add docs && git commit -m "docs(plan): fold observations" -m "${A.trailer}"`, 30, `git merge --no-ff ${prefix}`)}`,
  { label: 'fold', phase: 'Fold', schema: FOLD_SCHEMA }) : null
const sidePromises = (A.sideJobs || []).map(j => agent(`${RULES}
TASK (side job, independent of the build): ${j.prompt}
Write only to scratch outside the repo and return the output paths. Never commit; the orchestrator reviews a sample and commits.`,
  { label: `side:${j.label}`, phase: 'Side jobs' }))
let fold = null

phase('Build')
const results = []
let failed = null
for (let w = 0; w < A.waves.length; w++) {
  if (foldPromise && w + 1 === A.fold.beforeWave) {
    fold = await foldPromise
    log(fold ? `Folded: ${fold.changed.join('; ')}${fold.new_tasks.length ? ` | new tasks, not in this run: ${fold.new_tasks.join(', ')}` : ''}` : 'Fold agent failed; later waves run the unfolded plan')
  }
  const wave = A.waves[w].filter(id => !DONE.has(id) && FILE[id])
  const noFile = A.waves[w].filter(id => !DONE.has(id) && !FILE[id])
  if (noFile.length) log(`Wave ${w + 1}: no plan file for ${noFile.join(', ')}; skipped`)
  if (!wave.length) continue
  log(`Wave ${w + 1}/${A.waves.length}: ${wave.join(', ')}`)
  // ponytail: fixed batches; a slot pool would keep the cap full while a slow task runs
  const cap = A.maxParallel || wave.length
  const out = []
  for (let b = 0; b < wave.length; b += cap) {
    const batch = wave.slice(b, b + cap)
    out.push(...(await parallel(batch.map(id => () => runTask(id)))).map((r, i) => r || { id: batch[i], ok: false, stage: 'crash' }))
  }
  results.push(...out)
  const bad = out.filter(r => !r.ok)
  if (bad.length) {
    failed = { wave: w + 1, tasks: bad }
    log(`Stopping: wave ${w + 1} failed: ${bad.map(b => b.id).join(', ')}`)
    break
  }
}

if (foldPromise && !fold) fold = await foldPromise
const side = await Promise.all(sidePromises)

let final = null
if (!failed) {
  phase('Final')
  final = await agent(`${RULES}
TASK: Final whole-project verification on ${A.branch} in ${q(A.repo)}. Every scheduled task is merged. Do not add features.
${A.final}
1. Run every test suite and record pass and fail counts per command.
2. Check the spec's feature inventory item by item against the running project and the code: works, partial or missing, each with file:line.
3. Capture the evidence the steps name (screenshots, responses, output files) and look at each one; list only what you viewed.
4. Fix only small breakages (commit with the trailer, hooks passing). List bigger ones as gaps with file:line.`,
    { label: 'final-verify', phase: 'Final', schema: FINAL_SCHEMA })
}

const merged = results.filter(r => r.ok).map(r => r.id)
const ran = new Set([...DONE, ...merged])
return {
  merged,
  failed,
  not_run: [...A.tasks.map(t => t.id).filter(id => !ran.has(id)), ...(fold ? fold.new_tasks : [])],
  concerns: results.filter(r => r.ok && r.concerns.length).map(r => ({ id: r.id, concerns: r.concerns, deviations: r.deviations })),
  side,
  final,
}
