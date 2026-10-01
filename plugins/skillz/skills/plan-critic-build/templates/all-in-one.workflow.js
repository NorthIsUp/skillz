export const meta = {
  name: 'plan-build-all-in-one',
  description: 'Plan roadmap chunks against current code (dependent planners chained by needs), reconcile them into one task graph, then run the wave build and final verification',
  whenToUse: 'A working codebase plus a list of approved chunks (a v2 list, a TODO list) with decisions already pinned; no user gate needed between critic and build',
  phases: [
    { title: 'Plan', detail: 'one design + TDD plan per chunk; a chunk starts when the chunks it needs are planned' },
    { title: 'Critique', detail: 'one reconciler per chunk, combined compile check, task graph computed from the task data, priority chunk first' },
    { title: 'Build', detail: 'wave-build.workflow.js as a sub-workflow: implement, review, merge, final verification' },
  ],
}

// All project specifics arrive through `args`; nothing below names a project.
// {
//   repo, worktrees, branch, prefix, trailer, rules, setup, mergeLock, locks, assets, briefing, maxParallel, fold, sideJobs, final,  // passed to wave-build as is
//   plan:         '<abs path of the binding master plan>', spec: '<abs spec path>',
//   planDir:      '<abs dir for chunk plans; the critic writes README.md with the Execution Graph there>',
//   writingPlans: '<abs path to a plan-format skill, e.g. superpowers writing-plans SKILL.md>',
//   scratch:      '<abs dir for planner prototypes>',
//   waveBuild:    '<abs path to wave-build.workflow.js>',
//   priority:     'AA1',                                  // optional; chunk whose tasks go in the earliest waves
//   chunks:       [{ id, slug, brief, decisions: ['<binding decision>'], needs: [chunkId], hint: '<predecessor prototype path>' }],  // hint defaults to <scratch>/<id> when it exists
//   ledger:       '<abs dir in the repo for the run ledger>',  // required; each finished agent commits <kind>-<id>.json + a PROGRESS.md line
//   done:         { plans: { chunkId: planResult }, critic: graph, tasks: [taskId] },  // optional; merged over the ledger
//   argsScript:   '<abs path of a script that returns these args>',  // optional; for args too big to pass inline
// }
// Relaunching with the same args resumes: the ledger and the branch's "merge: <id>" commits mark what finished.
const A = args.argsScript ? { ...(await workflow({ scriptPath: args.argsScript })), ...args } : args
if (!A.ledger) throw new Error('args.ledger is required: finished results must be committed as they land')
if (A.chunks.some(c => c.id.toLowerCase() === 'graph')) throw new Error('chunk id "graph" is reserved: critic-graph.json is the graph writer\'s ledger entry')
const q = p => `"${p}"`
const slug = id => id.toLowerCase().replace(/[^a-z0-9]+/g, '-')

// mkdir is atomic, so the directory is the lock; the echo keeps the runtime from killing a silent waiter.
function locked(lock, cmd, staleMinutes) {
  return `n=0; until mkdir ${lock} 2>/dev/null; do n=$((n+1)); echo "waiting for ${lock} ($n)"; if [ -n "$(find ${lock} -maxdepth 0 -mmin +${staleMinutes})" ]; then rmdir ${lock}; fi; sleep 10; done; trap 'rmdir ${lock}' EXIT; ${cmd}`
}

// Scripts can't read files, so one cheap agent snapshots the ledger, merged task ids and leftover
// scratch prototypes into a script that workflow() runs to hand them back as data.
function ledgerCmd(out) {
  return [
    `mkdir -p ${q(A.ledger)} ${q(A.scratch)}`,
    `{ echo 'export const meta = { name: "run-ledger", description: "snapshot of a run ledger" }'`,
    `echo 'return { entries: ['`,
    `for f in ${q(A.ledger)}/*.json; do [ -e "$f" ] && cat "$f" && echo ,; done`,
    `echo '], merged: ['`,
    `git -C ${q(A.repo)} log --merges --format=%s ${A.branch} | sed -n 's/^merge: \\(.*\\)$/"\\1",/p'`,
    `echo '], scratch: ['`,
    `for p in ${q(A.scratch)}/*/; do [ -d "$p" ] && echo "\\"$(basename "$p")\\","; done`,
    `echo '] }'; } > ${q(out)} && echo ok`,
  ].join('; ')
}
async function loadLedger(out) {
  await agent(`Run exactly this one shell command, unchanged, and return its output:\n${ledgerCmd(out)}`, { label: 'ledger', phase: 'Plan', effort: 'low' })
  try { return await workflow({ scriptPath: out }) } catch (e) {
    log(`Ledger snapshot unreadable (${e.message}); only args.done counts as finished`)
    return { entries: [], merged: [], scratch: [] }
  }
}

// Each agent's last step, so a crash or usage-limit stop loses only the agents still running.
function record(kind, id, paths) {
  const entry = `${A.ledger}/${kind}-${slug(id)}.json`, progress = `${A.ledger}/PROGRESS.md`
  const files = [...paths, entry, progress].map(q).join(' ')
  return `LAST STEP, once your result is final: write ${q(entry)} containing exactly {"kind":"${kind}","id":"${id}","result":<the JSON object you will return>}, append the line "- ${kind} ${id}: <one-line summary>" to ${q(progress)}, then commit only those paths, holding the merge lock, in ONE bash invocation:
  ${locked(A.mergeLock, `cd ${q(A.repo)} && git add ${files} && git commit -m "docs(plan): ${kind} ${id}" -m "${A.trailer}" -- ${files}`, 30)}
Repo hooks run on this commit (absolute-path lints, PII scanners): fix the content and commit again, never skip them. If a hook rejects something outside your files, say so in your result.`
}
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

const RULES = `
${A.rules}
Repo: ${q(A.repo)} ${repoNote(A.repo)}, branch ${A.branch}. The code on ${A.branch} is the source of truth; read it and run it.
Binding docs: master plan ${q(A.plan)} (Global Constraints, Shared Contracts) and spec ${q(A.spec)}.
Paths written into committed docs are repo-relative or ~/..., never /Users/<name>/ or /home/<name>/.
Hard rules: never git --no-verify or any hook skip; a checkbox is ticked only with its artifact; batch verification (every edit first, then one build + lint pass; parameterized tests; one end-to-end run that captures all the evidence); never kill a process you did not start.
- Never wait silently: the runtime kills an agent after about 3 minutes without output. Run any command that may take over 2 minutes in the background with its output in a log, and poll the log with short commands at least every 2 minutes. Prefer the narrowest build or test that proves the point.
${briefing(A.briefing)}
${A.assets ? `Never commit anything under ${A.assets} and never copy copyrighted text verbatim; paraphrase.` : ''}
`

const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    path: { type: 'string' },
    tasks: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' }, files: { type: 'array', items: { type: 'string' } }, depends_on: { type: 'array', items: { type: 'string' } } }, required: ['id', 'title', 'files', 'depends_on'] } },
    produces: { type: 'array', items: { type: 'string' } },
    consumes: { type: 'array', items: { type: 'string' } },
    risks: { type: 'array', items: { type: 'string' } },
  },
  required: ['path', 'tasks', 'produces', 'consumes', 'risks'],
}
const GRAPH_SCHEMA = {
  type: 'object',
  properties: {
    fixes_applied: { type: 'array', items: { type: 'string' } },
    remaining_gaps: { type: 'array', items: { type: 'string' } },
    tasks: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, file: { type: 'string' }, depends_on: { type: 'array', items: { type: 'string' } } }, required: ['id', 'file', 'depends_on'] } },
    waves: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
  },
  required: ['fixes_applied', 'remaining_gaps', 'tasks', 'waves'],
}

const strings = { type: 'array', items: { type: 'string' } }
const RECONCILE_SCHEMA = {
  type: 'object',
  properties: {
    tasks: { ...PLAN_SCHEMA.properties.tasks, description: "this chunk's full task list after your edits" },
    produces: strings,
    fixes_applied: strings,
    remaining_gaps: strings,
  },
  required: ['tasks', 'produces', 'fixes_applied', 'remaining_gaps'],
}
const COMPILE_SCHEMA = {
  type: 'object',
  properties: {
    ran: { ...strings, description: 'each command you ran on the combined copy, with its result' },
    fixes_applied: strings,
    remaining_gaps: strings,
    tasks_changed: {
      type: 'array',
      items: { type: 'object', properties: { id: { type: 'string' }, files: strings, depends_on: strings }, required: ['id', 'files', 'depends_on'] },
    },
  },
  required: ['ran', 'fixes_applied', 'remaining_gaps', 'tasks_changed'],
}
const WRITER_SCHEMA = { type: 'object', properties: { remaining_gaps: strings }, required: ['remaining_gaps'] }

// Deterministic, so no agent reasons over every plan: waves are topological layers in which no two tasks
// share a file, so the tasks on a hot file land in successive waves. `first` tasks claim each wave first.
function computeGraph(tasks, first = () => false) {
  const gaps = [], byId = new Map()
  for (const t of tasks) byId.has(t.id) ? gaps.push(`duplicate task id ${t.id} in ${t.file}; kept the first`) : byId.set(t.id, t)
  const all = [...byId.values()]
  for (const t of all) for (const d of t.depends_on) if (!byId.has(d)) gaps.push(`${t.id} depends on unknown task ${d}; edge ignored`)
  const waveOf = {}, waves = []
  let left = [...all.filter(first), ...all.filter(t => !first(t))]
  while (left.length) {
    const wave = [], used = new Set()
    for (const t of left) {
      if (t.depends_on.some(d => byId.has(d) && !(d in waveOf)) || t.files.some(f => used.has(f))) continue
      wave.push(t.id)
      t.files.forEach(f => used.add(f))
    }
    if (!wave.length) break
    wave.forEach(id => { waveOf[id] = waves.length })
    waves.push(wave)
    left = left.filter(t => !(t.id in waveOf))
  }
  if (left.length) gaps.push(`not scheduled, dependency cycle: ${left.map(t => t.id).join(', ')}`)
  const touched = {}
  for (const t of all) for (const f of new Set(t.files)) (touched[f] = touched[f] || []).push(t.id)
  const hot_files = Object.entries(touched).filter(([, ids]) => ids.length > 1).map(([file, ids]) =>
    ({ file, tasks: ids, how: `serialized: waves ${ids.map(id => id in waveOf ? waveOf[id] + 1 : '-').join(', ')}` }))
  return { tasks: all.map(({ id, file, depends_on }) => ({ id, file, depends_on })), waves, hot_files, gaps }
}
function graphMarkdown(g) {
  const table = (head, rows) => [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map(r => `| ${r.join(' | ')} |`)]
  return ['## Execution Graph', '',
    ...table(['Task', 'Plan file', 'Depends on'], g.tasks.map(t => [t.id, t.file, t.depends_on.join(', ') || '-'])), '',
    '### Waves', '', ...g.waves.map((w, i) => `${i + 1}. ${w.join(', ')}`), '',
    '### Hot files', '', ...(g.hot_files.length ? table(['File', 'Tasks', 'How'], g.hot_files.map(h => [h.file, h.tasks.join(', '), h.how])) : ['None.']),
    ...(g.gaps.length ? ['', '### Not scheduled', '', ...g.gaps.map(x => `- ${x}`)] : []),
  ].join('\n')
}
// The monolithic critic died this way: one silent 4-17 minute turn at 100k+ context, killed at 3 minutes, restarted from zero.
const STALL = `
Anti-stall rules (a turn with no output for about 3 minutes is killed, and the retry starts from zero):
- Edit in small steps: one task or one block per edit, never a whole-file rewrite.
- Keep each turn short: read big files in chunks of at most 300 lines, only the parts you need; decide, act, move on.
- Print one progress line (echo) after each task or check you finish.`

function planPrompt(c, deps) {
  return `${RULES}
TASK: Design and plan chunk ${c.id} (${c.slug}). Write ONE document ${q(`${A.planDir}/${c.id}-${c.slug}.md`)}: a short design section (decisions, data and UI shapes, what changes where, test strategy), then TDD tasks in writing-plans format (read ${q(A.writingPlans)}). Task ids ${c.id}-T1, ${c.id}-T2, ...; depends_on may name tasks in other chunks. No placeholders.
Brief: ${c.brief}
${c.decisions && c.decisions.length ? `Pinned decisions (the user approved these; implement them, do not re-decide them):\n${c.decisions.map(d => `- ${d}`).join('\n')}` : ''}
${hintFor(c) ? `A previous planner for this chunk was interrupted; its scratch prototype is at ${q(hintFor(c))}. Move it aside (append .prev) before making your own scratch copy, inspect it and reuse what is sound; it may predate current ${A.branch}.` : ''}
${deps.length ? `Plans this chunk builds on (read them; use their exact names): ${deps.map(p => p.path).join(', ')}` : ''}
Prototype in ${q(`${A.scratch}/${c.id}`)}, a scratch copy of ${A.branch}: apply your tasks' code, run build, lint and tests, and probe any SDK, library or service API you are unsure of against the thing itself. The plan carries only code you ran. Only your plan doc and the ledger may change in the repo.
${record('plan', c.id, [`${A.planDir}/${c.id}-${c.slug}.md`])}`
}

phase('Plan')
const L = await loadLedger(`${A.scratch}/.ledger.workflow.js`)
const fromLedger = kind => Object.fromEntries(L.entries.filter(e => e.kind === kind).map(e => [e.id, e.result]))
const done = A.done || {}
const donePlans = { ...fromLedger('plan'), ...done.plans }
const doneCritic = fromLedger('critic')  // one entry per chunk reconciler, plus "graph" from the graph writer
const doneCompile = fromLedger('compile').all
const doneTasks = [...new Set([...(done.tasks || []), ...L.merged])]
const scratchLeft = new Set(L.scratch)
const hintFor = c => c.hint || (scratchLeft.has(c.id) ? `${A.scratch}/${c.id}` : '')
log(`Ledger: ${Object.keys(donePlans).length} chunk plans and ${Object.keys(doneCritic).length} critic steps done, ${doneTasks.length} task(s) merged`)
// The run record says "completed" whenever the script returns; `status` is what says whether the work did.
const incomplete = (what, extra) => {
  log(`INCOMPLETE: missing ${what}. Relaunch with the same args; the ledger skips what finished.`)
  return { status: 'INCOMPLETE', resume: { missing: what, ledger: A.ledger, relaunch: 'same scriptPath and args; finished work is read from the ledger and the branch, leftover prototypes become hints' }, ...extra }
}

const planPromises = {}
for (const c of A.chunks) {
  if (donePlans[c.id]) { planPromises[c.id] = Promise.resolve(donePlans[c.id]); continue }
  planPromises[c.id] = (async () => {
    const deps = await Promise.all((c.needs || []).map(n => planPromises[n]))
    return agent(planPrompt(c, deps.filter(Boolean)), { label: `plan:${c.id}`, phase: 'Plan', schema: PLAN_SCHEMA })
  })()
}
// needs is read after the first await, so forward references resolve; a cycle waits forever.
const planResults = await Promise.all(A.chunks.map(c => planPromises[c.id]))
const missing = A.chunks.filter((c, i) => !planResults[i]).map(c => c.id)
if (missing.length) return incomplete(`chunk plans ${missing.join(', ')}, critic, build`, { plans: planResults })

phase('Critique')
const summaries = A.chunks.map((c, i) => ({ id: c.id, ...planResults[i] }))
const order = A.chunks.map(c => c.id).join(', ')
let graph = done.critic
if (!graph) {
  const reconciled = {}
  for (const c of A.chunks) {
    if (doneCritic[c.id]) { reconciled[c.id] = Promise.resolve(doneCritic[c.id]); continue }
    reconciled[c.id] = (async () => {
      await null  // needs is read after an await, so forward references resolve
      const up = await Promise.all((c.needs || []).map(id => reconciled[id]))
      const mine = summaries.find(x => x.id === c.id)
      return agent(`${RULES}
TASK: Reconcile chunk ${c.id}'s plan ${q(mine.path)} with the other chunks. You own this one file: edit nothing else except the ledger. Other reconcilers are editing the other chunk plans at the same time.
Brief: ${c.brief}
Your chunk as planned: ${JSON.stringify(mine)}
Final produces of the chunks you build on (match them verbatim): ${JSON.stringify((c.needs || []).map((id, i) => [id, (up[i] || summaries.find(x => x.id === id) || {}).produces]))}
Produces of every other chunk, as planned: ${JSON.stringify(summaries.filter(x => x.id !== c.id).map(x => [x.id, x.produces]))}
Consumes of the chunks that build on yours: ${JSON.stringify(A.chunks.filter(x => (x.needs || []).includes(c.id)).map(x => [x.id, summaries.find(y => y.id === x.id).consumes]))}
Fix in place, one task at a time:
1. Consumes: every name you consume matches a producer's produces verbatim (name and signature), and the producing task is in the consuming task's depends_on. Change your side, never the producer's. A name nobody produces: add the task if it is in your brief, else list it in remaining_gaps with the chunk that should produce it.
2. Collisions: when you define a symbol or file another chunk defines differently, the chunk earlier in this order keeps it: ${order}. If that isn't you, rename yours and every use in your file.
3. Brief coverage: every brief item maps to a task; add tasks where one is missing.
4. Placeholders: TBD, TODO, "similar to", sketches instead of code. Replace each with real code.
5. Tooling: every run command your tasks use exists in the task runner or is created by an earlier task.
If your prototype ${q(`${A.scratch}/${c.id}`)} exists, apply your code changes there too and run the narrowest build or test that covers them, in the background with a log.
Return your chunk's full task list after the edits (ids, titles, every file each task touches, depends_on) and its produces.
${STALL}
${record('critic', c.id, [mine.path])}`, { label: `reconcile:${c.id}`, phase: 'Critique', schema: RECONCILE_SCHEMA, effort: 'medium' })
    })()
  }
  const recs = await Promise.all(A.chunks.map(c => reconciled[c.id]))
  const lost = A.chunks.filter((c, i) => !recs[i]).map(c => `reconcile:${c.id}`)
  if (lost.length) return incomplete(`critic steps ${lost.join(', ')}, compile, graph, build`, { plans: planResults })

  const tasks = A.chunks.flatMap((c, i) => recs[i].tasks.map(t => ({ ...t, file: summaries[i].path })))
  const priorityFirst = t => !!A.priority && t.id.startsWith(`${A.priority}-`)
  const compile = doneCompile || await agent(`${RULES}
TASK: Combined compile check. Each planner proved its own chunk in its prototype; you prove all chunks together.
Chunks in order, with plan file and prototype (a scratch copy of ${A.branch} with that chunk's code applied, updated by its reconciler; gone after a reboot): ${JSON.stringify(A.chunks.map((c, i) => [c.id, summaries[i].path, `${A.scratch}/${c.id}`]))}
Draft waves (recomputed from your tasks_changed): ${JSON.stringify(computeGraph(tasks, priorityFirst).waves)}
1. Make one fresh scratch copy of ${A.branch} at ${q(`${A.scratch}/_combined`)}. Apply each chunk's changes in the order above: the prototype's diff against ${A.branch} (git -C <prototype> diff ${A.branch}, or diff -ruN when it is not a git checkout). Where a prototype is gone, apply that chunk's task code from its plan, one task at a time. Do not read the plans otherwise.
2. Build, lint and test the combined copy in the background with the output in a log, polling it.
3. Where it breaks, fix the owning task's code in its plan and in the combined copy, one task at a time, then re-run.
Never add, remove or rename tasks; list what needs that in remaining_gaps. When a fix changes a task's files or depends_on, return that task in tasks_changed.
${STALL}
${record('compile', 'all', [A.planDir])}`, { label: 'compile', phase: 'Critique', schema: COMPILE_SCHEMA })
  if (!compile) return incomplete('critic steps compile, graph, build', { plans: planResults })

  const changed = Object.fromEntries(compile.tasks_changed.map(t => [t.id, t]))
  const g = computeGraph(tasks.map(t => changed[t.id] ? { ...t, files: changed[t.id].files, depends_on: changed[t.id].depends_on } : t), priorityFirst)
  const writer = doneCritic.graph || await agent(`${RULES}
TASK: Write the Execution Graph into ${q(`${A.planDir}/README.md`)}. The script computed it from the reconciled task data; do not re-derive it or read the chunk plans in full.
1. Replace any existing "## Execution Graph" section of that file with exactly this text, placed at the end (create the file if missing):
${graphMarkdown(g)}
2. Sanity check: grep each plan file for its "### Task <id>" headings. List every task in the graph without one, and anything else in the graph that contradicts the plans, in remaining_gaps. Do not edit chunk plans.
${STALL}
${record('critic', 'graph', [A.planDir])}`, { label: 'graph-writer', phase: 'Critique', schema: WRITER_SCHEMA, effort: 'low' })
  if (!writer) return incomplete('critic step graph, build', { plans: planResults })

  const tagged = (key, sources) => sources.flatMap(([id, r]) => r[key].map(x => `${id}: ${x}`))
  const sources = [...A.chunks.map((c, i) => [c.id, recs[i]]), ['compile', compile]]
  graph = {
    fixes_applied: [...tagged('fixes_applied', sources), ...compile.ran.map(x => `compile ran: ${x}`)],
    remaining_gaps: [...tagged('remaining_gaps', [...sources, ['graph', writer]]), ...g.gaps],
    tasks: g.tasks, waves: g.waves,
  }
}

// A priority task could run one wave after its latest dependency; later than that is flagged, not reordered.
if (A.priority) {
  const deps = Object.fromEntries(graph.tasks.map(t => [t.id, t.depends_on]))
  const waveOf = Object.fromEntries(graph.waves.flatMap((w, i) => w.map(id => [id, i + 1])))
  const late = graph.waves.flat().filter(id => id.startsWith(`${A.priority}-`) &&
    waveOf[id] > 1 + Math.max(0, ...(deps[id] || []).map(d => waveOf[d] || 0)))
  if (late.length) log(`Priority tasks later than their dependencies require: ${late.join(', ')}`)
}
log(`Graph: ${graph.tasks.length} tasks in ${graph.waves.length} waves`)

phase('Build')
const build = await workflow({ scriptPath: A.waveBuild }, {
  repo: A.repo, worktrees: A.worktrees, branch: A.branch, prefix: A.prefix, plan: A.plan, spec: A.spec,
  trailer: A.trailer, rules: A.rules, setup: A.setup, mergeLock: A.mergeLock, locks: A.locks,
  assets: A.assets, briefing: A.briefing, maxParallel: A.maxParallel, fold: A.fold, sideJobs: A.sideJobs, final: A.final,
  tasks: graph.tasks, waves: graph.waves, done: doneTasks, ledger: A.ledger, ledgerLoaded: true,
})

if (!build || build.status !== 'complete') return incomplete('build (see build.failed, build.not_run)', { graph, build })
return { status: 'complete', plan_fixes: graph.fixes_applied, plan_gaps: graph.remaining_gaps, graph, build }
