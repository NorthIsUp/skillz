export const meta = {
  name: 'plan-build-all-in-one',
  description: 'Plan roadmap chunks against current code (dependent planners chained by needs), reconcile them into one task graph, then run the wave build and final verification',
  whenToUse: 'A working codebase plus a list of approved chunks (a v2 list, a TODO list) with decisions already pinned; no user gate needed between critic and build',
  phases: [
    { title: 'Plan', detail: 'one design + TDD plan per chunk; a chunk starts when the chunks it needs are planned' },
    { title: 'Critique', detail: 'cross-chunk consistency, compile check, task graph and waves, priority chunk first' },
    { title: 'Build', detail: 'wave-build.workflow.js as a sub-workflow: implement, review, merge, final verification' },
  ],
}

// All project specifics arrive through `args`; nothing below names a project.
// {
//   repo, worktrees, branch, prefix, trailer, rules, setup, mergeLock, locks, assets, briefing, maxParallel, fold, sideJobs, final,  // passed to wave-build as is
//   plan:         '<abs path of the binding master plan>', spec: '<abs spec path>',
//   planDir:      '<abs dir for chunk plans; the critic writes README.md with the Execution Graph there>',
//   writingPlans: '<abs path to writing-plans SKILL.md>',
//   scratch:      '<abs dir for planner prototypes>',
//   waveBuild:    '<abs path to wave-build.workflow.js>',
//   priority:     'AA1',                                  // optional; chunk whose tasks go in the earliest waves
//   chunks:       [{ id, slug, brief, decisions: ['<binding decision>'], needs: [chunkId], hint: '<predecessor prototype path>' }],
//   done:         { plans: { chunkId: planResult }, tasks: [taskId] },  // finished work from an earlier run
// }
const A = args
const done = A.done || {}
const donePlans = done.plans || {}
const q = p => `"${p}"`
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
Hard rules: never git --no-verify or any hook skip; a checkbox is ticked only with its artifact; batch verification (every edit first, then one build + lint pass; parameterized tests; one UI run that captures every screenshot); never kill a process you did not start.
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

function planPrompt(c, deps) {
  return `${RULES}
TASK: Design and plan chunk ${c.id} (${c.slug}). Write ONE document ${q(`${A.planDir}/${c.id}-${c.slug}.md`)}: a short design section (decisions, data and UI shapes, what changes where, test strategy), then TDD tasks in writing-plans format (read ${q(A.writingPlans)}). Task ids ${c.id}-T1, ${c.id}-T2, ...; depends_on may name tasks in other chunks. No placeholders.
Brief: ${c.brief}
${c.decisions && c.decisions.length ? `Pinned decisions (the user approved these; implement them, do not re-decide them):\n${c.decisions.map(d => `- ${d}`).join('\n')}` : ''}
${c.hint ? `A previous planner for this chunk was interrupted; its scratch prototype is at ${q(c.hint)}. Inspect it first and reuse what is sound; it may predate current ${A.branch}.` : ''}
${deps.length ? `Plans this chunk builds on (read them; use their exact names): ${deps.map(p => p.path).join(', ')}` : ''}
Prototype in ${q(`${A.scratch}/${c.id}`)}, a scratch copy of ${A.branch}: apply your tasks' code, run build, lint and tests, and probe any SDK, library or service API you are unsure of against the thing itself. The plan carries only code you ran. Only your plan doc may change in the repo; do not commit.`
}

phase('Plan')
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
if (missing.length) return { stopped: 'planning failed', missing, plans: planResults }

phase('Critique')
const merge = `until mkdir ${A.mergeLock} 2>/dev/null; do sleep 3; done; trap 'rmdir ${A.mergeLock}' EXIT; cd ${q(A.repo)} && git add ${q(A.planDir)} && git commit -m "docs(plan): chunk plans and execution graph" -m "${A.trailer}"`
const graph = await agent(`${RULES}
TASK: Plan critic. Read every chunk plan in ${q(A.planDir)} fully and the code they touch. Chunk summaries: ${JSON.stringify(A.chunks.map((c, i) => ({ id: c.id, ...planResults[i] })))}
FIX IN PLACE: every consumes met by an earlier task's produces with identical signatures; no two chunks define one symbol or file differently; tasks editing the same file ordered through depends_on; every brief item maps to a task (add tasks where missing); placeholders removed; every run command exists in the task runner.
Compile check: assemble every chunk's code together in one scratch copy of ${A.branch} under ${q(A.scratch)}, build, lint and test it, and fix the plans where it breaks.
${A.priority ? `PRIORITY (user): chunk ${A.priority} matters most. Put its tasks in the earliest waves their dependencies allow, never behind work they don't depend on.` : ''}
Write "## Execution Graph" (dependencies, waves of disjoint-file tasks, hot files) into ${q(`${A.planDir}/README.md`)}, then commit the plan docs holding the merge lock: ${merge}
Return every task with the plan file holding its "### Task <id>" block, and the waves.`,
  { label: 'critic', phase: 'Critique', schema: GRAPH_SCHEMA })
if (!graph) return { stopped: 'critic failed', plans: planResults }

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
  tasks: graph.tasks, waves: graph.waves, done: done.tasks || [],
})

return { plan_fixes: graph.fixes_applied, plan_gaps: graph.remaining_gaps, graph, build }
