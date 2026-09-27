export const meta = {
  name: 'plan-critic',
  description: 'Research unknowns, write per-section TDD plans against shared contracts in parallel, then have a critic reconcile them into one plan with an execution graph',
  whenToUse: 'After a spec and a master plan with Shared Contracts exist; before a wave build',
  phases: [
    { title: 'Research', detail: 'one agent per unknown; findings land in committed docs' },
    { title: 'Write', detail: 'one planner per section, writing against the shared contracts' },
    { title: 'Critique', detail: 'spec coverage, one reconciler per section, combined compile check, execution graph computed from the task data' },
  ],
}

// All project specifics arrive through `args`; nothing below names a project.
// {
//   repo:        '<abs repo path>',                       // quoted everywhere, so spaces are fine
//   spec:        '<abs spec path>',
//   plan:        '<abs master plan path>',                // holds Shared Contracts, Global Constraints, Review Focus
//   sectionsDir: '<abs dir for section plans>',
//   researchDir: '<abs dir for research docs>',           // committed, never /tmp
//   writingPlans:'<abs path to writing-plans SKILL.md>',
//   trailer:     'Co-Authored-By: <model> <noreply@anthropic.com>',
//   context:     '<project brief: goal, build/test/lint commands, binding rules the planners need>',
//   briefing:    { toolkit: ['<path>  <fn(args) -> result>'], toolkitRecipe: '<how to rebuild the toolkit>',
//                  facts: ['<already verified>'], limits: ['<environment limit>'], toolchain: '<versions and style bar>' },  // optional
//   scratch:     '<abs dir for planner prototypes>',       // outside the repo; survives a session restart, not a reboot
//   ledger:      '<abs dir in the repo for the run ledger>',  // required; each finished agent commits <kind>-<id>.json + a PROGRESS.md line
//   mergeLock:   '/tmp/<proj>-merge.lock',                 // required; serializes those commits
//   research:    [{ key, title, ask, observe: '<how to run the original, e.g. an emulator URL>', minutes: 90 }],  // optional; observe/minutes optional
//   sections:    [{ id, scope, decisions: ['<binding decision the user approved>'], needs: [researchKey], dependsOn: [sectionId],
//                   hint: '<path of an interrupted predecessor prototype>' }],   // decisions optional; hint defaults to <scratch>/<id> when it exists
//   done:        { research: { key: result }, sections: { id: result }, critic: graph },  // optional; merged over the ledger; critic skips the whole Critique phase
//   argsScript:  '<abs path of a script that returns these args>',  // optional; for args too big to pass inline
// }
// Relaunching with the same args resumes: the ledger marks what finished, leftover prototypes become hints.
const A = args.argsScript ? { ...(await workflow({ scriptPath: args.argsScript })), ...args } : args
if (!A.ledger || !A.mergeLock) throw new Error('args.ledger and args.mergeLock are required: finished results must be committed as they land')
if (A.sections.some(s => s.id.toLowerCase() === 'graph')) throw new Error('section id "graph" is reserved: critic-graph.json is the graph writer\'s ledger entry')
const research = A.research || []
const q = p => `"${p}"`
const slug = id => id.toLowerCase().replace(/[^a-z0-9]+/g, '-')

// mkdir is atomic, so the directory is the lock; a waiter clears one older than staleMinutes whose holder is gone.
// The echo matters: the runtime kills an agent after ~3 silent minutes.
function locked(lock, cmd, staleMinutes, busyPattern) {
  const alive = busyPattern ? ` && ! pgrep -f ${q(busyPattern)} >/dev/null` : ''
  return `n=0; until mkdir ${lock} 2>/dev/null; do n=$((n+1)); echo "waiting for ${lock} ($n)"; if [ -n "$(find ${lock} -maxdepth 0 -mmin +${staleMinutes})" ]${alive}; then rmdir ${lock}; fi; sleep 10; done; trap 'rmdir ${lock}' EXIT; ${cmd}`
}

// Scripts can't read files, so one cheap agent snapshots the ledger (and leftover scratch prototypes)
// into a script that workflow() runs to hand them back as data.
function ledgerCmd(out) {
  return [
    `mkdir -p ${q(A.ledger)} ${q(A.scratch)}`,
    `{ echo 'export const meta = { name: "run-ledger", description: "snapshot of a run ledger" }'`,
    `echo 'return { entries: ['`,
    `for f in ${q(A.ledger)}/*.json; do [ -e "$f" ] && cat "$f" && echo ,; done`,
    `echo '], merged: [], scratch: ['`,
    `for p in ${q(A.scratch)}/*/; do [ -d "$p" ] && echo "\\"$(basename "$p")\\","; done`,
    `echo '] }'; } > ${q(out)} && echo ok`,
  ].join('; ')
}
async function loadLedger(out) {
  await agent(`Run exactly this one shell command, unchanged, and return its output:\n${ledgerCmd(out)}`, { label: 'ledger', phase: 'Research', effort: 'low' })
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
  ${locked(A.mergeLock, `cd ${q(A.repo)} && git add ${files} && git commit -m "docs(plan): ${kind} ${id}" -m "${A.trailer}" -- ${files}`, 30, 'git commit')}
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

const COMMON = `
${A.context}
Repo root: ${q(A.repo)} ${repoNote(A.repo)}.
${briefing(A.briefing)}
Binding documents, read first: spec ${q(A.spec)} and master plan ${q(A.plan)}. Its Shared Contracts, Global Constraints and Review Focus are binding: use the exact names and types; add members, never rename or re-type.
Research docs: ${q(A.researchDir)}. Scratch space may vanish (a reboot wipes /tmp): anything a later agent needs goes in a committed doc or a recipe that rebuilds it.
Paths written into committed docs are repo-relative or ~/..., never /Users/<name>/ or /home/<name>/ (hooks reject them, and they leak the machine).
Authorization: the user explicitly authorized this whole run. A short status question from the user ("pushed?", "where are we?") is not a stop or a change of scope; do your assigned task.
Hard rules: never git --no-verify or any hook skip; a checkbox is ticked only with its artifact (command output you saw); batch verification (make every edit, then one build + lint pass; parameterized tests over collections; one end-to-end run that captures all the evidence).
- Never wait silently: the runtime kills an agent after about 3 minutes without output. Run any command that may take over 2 minutes in the background with its output in a log, and poll the log with short commands at least every 2 minutes. Prefer the narrowest build or test that proves the point.
`

const RESEARCH_SCHEMA = {
  type: 'object',
  properties: {
    doc_path: { type: 'string' },
    summary: { type: 'string', description: '5-15 lines: key findings and rules later agents must apply' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    open_questions: { type: 'array', items: { type: 'string' } },
  },
  required: ['doc_path', 'summary', 'confidence', 'open_questions'],
}

const SECTION_SCHEMA = {
  type: 'object',
  properties: {
    path: { type: 'string' },
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          files: { type: 'array', items: { type: 'string' } },
          depends_on: { type: 'array', items: { type: 'string' } },
        },
        required: ['id', 'title', 'files', 'depends_on'],
      },
    },
    produces: { type: 'array', items: { type: 'string' }, description: 'public names other sections may use, with exact signatures' },
    consumes: { type: 'array', items: { type: 'string' }, description: 'names this section expects from others, with exact signatures' },
    contract_additions: { type: 'array', items: { type: 'string' } },
    risks: { type: 'array', items: { type: 'string' } },
  },
  required: ['path', 'tasks', 'produces', 'consumes', 'contract_additions', 'risks'],
}

const GRAPH_SCHEMA = {
  type: 'object',
  properties: {
    fixes_applied: { type: 'array', items: { type: 'string' } },
    spec_changes: { type: 'array', items: { type: 'string' } },
    remaining_gaps: { type: 'array', items: { type: 'string' } },
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          file: { type: 'string', description: 'plan file holding the "### Task <id>" block' },
          depends_on: { type: 'array', items: { type: 'string' } },
        },
        required: ['id', 'file', 'depends_on'],
      },
    },
    waves: { type: 'array', items: { type: 'array', items: { type: 'string' } } },
    hot_files: {
      type: 'array',
      items: {
        type: 'object',
        properties: { file: { type: 'string' }, tasks: { type: 'array', items: { type: 'string' } }, how: { type: 'string' } },
        required: ['file', 'tasks', 'how'],
      },
    },
  },
  required: ['fixes_applied', 'spec_changes', 'remaining_gaps', 'tasks', 'waves', 'hot_files'],
}

const TASKS = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      title: { type: 'string' },
      files: { type: 'array', items: { type: 'string' } },
      depends_on: { type: 'array', items: { type: 'string' } },
    },
    required: ['id', 'title', 'files', 'depends_on'],
  },
}
const strings = { type: 'array', items: { type: 'string' } }
const COVERAGE_SCHEMA = {
  type: 'object',
  properties: {
    assignments: {
      type: 'array',
      items: { type: 'object', properties: { section: { type: 'string' }, items: strings }, required: ['section', 'items'] },
      description: 'spec requirements and Review Focus items no task covers, grouped by the section whose scope owns them',
    },
    remaining_gaps: { ...strings, description: 'uncovered items no section owns' },
  },
  required: ['assignments', 'remaining_gaps'],
}
const RECONCILE_SCHEMA = {
  type: 'object',
  properties: {
    tasks: { ...TASKS, description: "this section's full task list after your edits" },
    produces: strings,
    contract_additions: strings,
    fixes_applied: strings,
    spec_changes: { ...strings, description: 'proposed, not applied: exact replacement text and the research that proved the spec wrong' },
    remaining_gaps: strings,
  },
  required: ['tasks', 'produces', 'contract_additions', 'fixes_applied', 'spec_changes', 'remaining_gaps'],
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

phase('Research')
const L = await loadLedger(`${A.scratch}/.ledger.workflow.js`)
const fromLedger = kind => Object.fromEntries(L.entries.filter(e => e.kind === kind).map(e => [e.id, e.result]))
const done = A.done || {}
const doneResearch = { ...fromLedger('research'), ...done.research }
const doneSections = { ...fromLedger('section'), ...done.sections }
const doneCritic = fromLedger('critic')  // one entry per section reconciler, plus "graph" from the graph writer
const doneCoverage = fromLedger('coverage').spec, doneCompile = fromLedger('compile').all
const scratchLeft = new Set(L.scratch)
const hintFor = s => s.hint || (scratchLeft.has(s.id) ? `${A.scratch}/${s.id}` : '')
log(`Ledger: ${Object.keys(doneResearch).length} research, ${Object.keys(doneSections).length} sections and ${Object.keys(doneCritic).length} critic steps already done`)

const researchPromises = {}
for (const r of research) {
  researchPromises[r.key] = doneResearch[r.key]
    ? Promise.resolve(doneResearch[r.key])
    : agent(`${COMMON}
TASK (research; read-only except your one doc): ${r.title}
${r.ask}
Work empirically: back every claim with code or commands you actually ran against the real inputs, not samples or docs. Embed the verified code (decoders, probes, queries) in the doc so planners reuse it.
Keep the doc copyright-clean: no copyrighted images, audio or verbatim text; describe, measure and paraphrase.
${r.observe ? `Observe the reference implementation, don't infer: run it (${r.observe}), drive it with whatever fits (a browser driver such as Playwright for web apps and emulators, the old binary with captured output for a CLI, recorded requests for a service), capture evidence for every state you measure and measure from that evidence. Record the recipe that got it running so the next observer skips the setup. Mark each finding high / medium / low confidence. Time box: ${r.minutes || 90} minutes, then write up what you have plus what stays unobserved.` : ''}
Write findings to ${q(`${A.researchDir}/${r.key}.md`)}.
${record('research', r.key, [`${A.researchDir}/${r.key}.md`])}`,
      { label: `research:${r.key}`, phase: 'Research', schema: RESEARCH_SCHEMA })
}

function sectionPrompt(s, researchDeps, sectionDeps) {
  const rb = researchDeps.map(([k, d]) => d
    ? `- ${k}: ${d.doc_path} (confidence ${d.confidence})\n  ${d.summary.replace(/\n/g, '\n  ')}\n  open: ${d.open_questions.join(' | ')}`
    : `- ${k}: RESEARCH FAILED; say what you assumed`).join('\n')
  const sb = sectionDeps.filter(([, d]) => d).map(([id, d]) => `- ${id}: ${d.path}`).join('\n')
  return `${COMMON}
TASK: Write the implementation plan section "${s.id}" to ${q(`${A.sectionsDir}/${s.id}.md`)}.
Scope: ${s.scope}
${s.decisions && s.decisions.length ? `Pinned decisions (the user approved these; implement them, do not re-decide or reopen them):\n${s.decisions.map(d => `- ${d}`).join('\n')}` : ''}
${hintFor(s) ? `A previous planner for this section was interrupted; its scratch prototype is at ${q(hintFor(s))}. Move it aside (append .prev) before making your own scratch copy, inspect it and reuse what is sound; it may predate current code.` : ''}
${rb ? `Research to read and build on:\n${rb}` : ''}
${sb ? `Sections this one builds on (read them; use their exact names):\n${sb}` : ''}
Follow the writing-plans format exactly (read ${q(A.writingPlans)}): each task has Files, Interfaces (Consumes / Produces with exact signatures) and checkbox steps: failing test with real code -> run it (exact command, expected failure) -> complete implementation code -> run (expected pass) -> lint/hooks pass -> commit (exact command, conventional message ending with '${A.trailer}'). No placeholders, no "similar to Task N". Task ids ${s.id}-T1, ${s.id}-T2, ...; depends_on lists ids from any section.
Name every file each task touches.
Prototype before you write: copy the repo to ${q(`${A.scratch}/${s.id}`)}, apply your tasks' code there, and run the build, lint and tests. Probe every SDK, library or service API you are unsure of against the thing itself: a typecheck-only compile of a one-file probe, a grep of its installed interface or type stubs, a query against a scratch instance. The plan carries only code you ran. Never modify the repo except your plan file and the ledger.
${record('section', s.id, [`${A.sectionsDir}/${s.id}.md`])}`
}

phase('Write')
const sectionPromises = {}
for (const s of A.sections) {
  if (doneSections[s.id]) { sectionPromises[s.id] = Promise.resolve(doneSections[s.id]); continue }
  sectionPromises[s.id] = (async () => {
    const needs = s.needs || [], deps = s.dependsOn || []
    const r = await Promise.all(needs.map(k => researchPromises[k]))
    const d = await Promise.all(deps.map(id => sectionPromises[id]))
    return agent(sectionPrompt(s, needs.map((k, i) => [k, r[i]]), deps.map((id, i) => [id, d[i]])),
      { label: `write:${s.id}`, phase: 'Write', schema: SECTION_SCHEMA })
  })()
}
// dependsOn is read after the first await, so forward references resolve; a cycle waits forever.
const sectionResults = await Promise.all(A.sections.map(s => sectionPromises[s.id]))
const researchResults = await Promise.all(research.map(r => researchPromises[r.key]))
const missingResearch = research.filter((r, i) => !researchResults[i]).map(r => r.key)
const missing = A.sections.filter((s, i) => !sectionResults[i]).map(s => s.id)
// The run record says "completed" whenever the script returns; `status` is what says whether the work did.
const incomplete = (sections, critic) => {
  log(`INCOMPLETE: missing research [${missingResearch.join(', ')}], sections [${sections.join(', ')}], critic [${critic.join(', ')}]. Relaunch with the same args; the ledger skips what finished.`)
  return {
    status: 'INCOMPLETE',
    resume: { missing: { research: missingResearch, sections, critic }, ledger: A.ledger, relaunch: 'same scriptPath and args; finished work is read from the ledger, leftover prototypes become hints' },
    research: researchResults, sections: sectionResults,
  }
}
if (missing.length) return incomplete(missing, ['all'])

phase('Critique')
const summaries = A.sections.map((s, i) => ({ id: s.id, ...sectionResults[i] }))
const sectionFile = s => `${A.sectionsDir}/${s.id}.md`
const order = A.sections.map(s => s.id).join(', ')
let graph = done.critic
if (!graph) {
  const coveragePromise = (doneCoverage || A.sections.every(s => doneCritic[s.id])) ? Promise.resolve(doneCoverage || { assignments: [], remaining_gaps: [] }) : agent(`${COMMON}
TASK: Spec coverage check for the plan critic. Edit nothing except the ledger.
Every planned task (section, id, title): ${JSON.stringify(summaries.map(s => s.tasks.map(t => [s.id, t.id, t.title])).flat())}
Section scopes: ${JSON.stringify(A.sections.map(s => [s.id, s.scope]))}
Find every spec requirement no task covers and every Review Focus item in the master plan no task tests, and assign each to the section whose scope owns it. Work from the task titles; open a section file only to settle a doubtful match, and read only that task's block.
${STALL}
${record('coverage', 'spec', [])}`, { label: 'coverage', phase: 'Critique', schema: COVERAGE_SCHEMA, effort: 'medium' })

  const reconciled = {}
  for (const s of A.sections) {
    if (doneCritic[s.id]) { reconciled[s.id] = Promise.resolve(doneCritic[s.id]); continue }
    reconciled[s.id] = (async () => {
      const coverage = await coveragePromise
      if (!coverage) return null
      const up = await Promise.all((s.dependsOn || []).map(id => reconciled[id]))
      const mine = summaries.find(x => x.id === s.id)
      const others = summaries.filter(x => x.id !== s.id)
      const items = coverage.assignments.filter(a => a.section === s.id).flatMap(a => a.items)
      return agent(`${COMMON}
TASK: Reconcile plan section "${s.id}" (${q(sectionFile(s))}) with the rest of the plan. You own this one file: edit nothing else except the ledger. Other reconcilers are editing the other sections at the same time.
Your section as planned: ${JSON.stringify(mine)}
Final produces of the sections you build on (match them verbatim): ${JSON.stringify((s.dependsOn || []).map((id, i) => [id, (up[i] || summaries.find(x => x.id === id) || {}).produces]))}
Produces of every other section, as planned: ${JSON.stringify(others.map(x => [x.id, x.produces]))}
Consumes of the sections that build on yours: ${JSON.stringify(A.sections.filter(x => (x.dependsOn || []).includes(s.id)).map(x => [x.id, summaries.find(y => y.id === x.id).consumes]))}
Contract additions from every section: ${JSON.stringify(summaries.map(x => [x.id, x.contract_additions]))}
${items.length ? `Uncovered spec requirements and Review Focus items the coverage check assigned to you:\n${items.map(x => `- ${x}`).join('\n')}` : ''}
Fix in place, one task at a time:
1. Consumes: every name you consume matches a producer's produces verbatim (name and signature), and the producing task is in the consuming task's depends_on. Change your side, never the producer's. A name nobody produces: add the task if it is in your scope, else list it in remaining_gaps with the section that should produce it.
2. Produces and Shared Contracts: never rename or re-type them. Add a produce when a section that builds on yours consumes something in your scope you don't produce yet.
3. Contract additions: when one of yours collides with another section's (same name, different shape), the section earlier in this order keeps the name: ${order}. If that isn't you, rename yours and every use in your file.
4. Coverage: add a task, or a test step in an existing task, for each assigned item.
5. Placeholders: TBD, TODO, "similar to", "add error handling", sketches instead of code. Replace each with real code.
6. Tooling: every run command your tasks use exists or is created by an earlier task; otherwise add the step that creates it.
7. Never edit the spec or the master plan. Return spec changes (exact replacement text plus the research that proved the spec wrong) and your contract additions; the graph writer applies them.
If your prototype ${q(`${A.scratch}/${s.id}`)} exists, apply your code changes there too and run the narrowest build or test that covers them, in the background with a log.
Return your section's full task list after the edits (ids, titles, every file each task touches, depends_on) and its produces.
${STALL}
${record('critic', s.id, [sectionFile(s)])}`, { label: `reconcile:${s.id}`, phase: 'Critique', schema: RECONCILE_SCHEMA, effort: 'medium' })
    })()
  }
  // dependsOn is read after the coverage await, so forward references resolve.
  const recs = await Promise.all(A.sections.map(s => reconciled[s.id]))
  const coverage = await coveragePromise
  const lost = [...(coverage ? [] : ['coverage']), ...A.sections.filter((s, i) => !recs[i]).map(s => `reconcile:${s.id}`)]
  if (lost.length) return incomplete([], [...lost, 'compile', 'graph'])

  const tasks = A.sections.flatMap((s, i) => recs[i].tasks.map(t => ({ ...t, file: summaries[i].path })))
  const compile = doneCompile || await agent(`${COMMON}
TASK: Combined compile check. Each planner proved its own section in its prototype; you prove all sections together.
Sections in order, with plan file and prototype (a copy of the repo with that section's code applied, updated by its reconciler; gone after a reboot): ${JSON.stringify(A.sections.map(s => [s.id, sectionFile(s), `${A.scratch}/${s.id}`]))}
Draft waves (recomputed from your tasks_changed): ${JSON.stringify(computeGraph(tasks).waves)}
1. Make one fresh scratch copy of the repo at ${q(`${A.scratch}/_combined`)}. Apply each section's changes in the order above: the prototype's diff against the repo's HEAD (git -C <prototype> diff HEAD, or diff -ruN when it is not a git checkout). Where a prototype is gone, apply that section's task code from its plan file, one task at a time. Do not read the plans otherwise.
2. Build, lint and test the combined copy in the background with the output in a log, polling it.
3. Where it breaks, fix the owning task's code in its plan file and in the combined copy, one task at a time, then re-run.
Never add, remove or rename tasks; list what needs that in remaining_gaps. When a fix changes a task's files or depends_on, return that task in tasks_changed.
${STALL}
${record('compile', 'all', [A.sectionsDir])}`, { label: 'compile', phase: 'Critique', schema: COMPILE_SCHEMA })
  if (!compile) return incomplete([], ['compile', 'graph'])

  const changed = Object.fromEntries(compile.tasks_changed.map(t => [t.id, t]))
  const g = computeGraph(tasks.map(t => changed[t.id] ? { ...t, files: changed[t.id].files, depends_on: changed[t.id].depends_on } : t))
  const additions = recs.flatMap((r, i) => r.contract_additions.map(x => `${A.sections[i].id}: ${x}`))
  const specChanges = recs.flatMap((r, i) => r.spec_changes.map(x => `${A.sections[i].id}: ${x}`))
  const writer = doneCritic.graph || await agent(`${COMMON}
TASK: Write the Execution Graph into the master plan ${q(A.plan)}. The script computed it from the reconciled task data; do not re-derive it or read the section plans in full.
1. Replace any existing "## Execution Graph" section of the master plan with exactly this text, placed at the end:
${graphMarkdown(g)}
2. Record these contract additions under Shared Contracts (add, never rename): ${JSON.stringify(additions)}
3. Apply these spec changes to the spec ${q(A.spec)}: ${JSON.stringify(specChanges)}
4. Sanity check: grep each plan file for its "### Task <id>" headings. List every task in the graph without one, and anything else in the graph that contradicts the plans, in remaining_gaps. Do not edit section files.
${STALL}
${record('critic', 'graph', [A.plan, A.spec])}`, { label: 'graph-writer', phase: 'Critique', schema: WRITER_SCHEMA, effort: 'low' })
  if (!writer) return incomplete([], ['graph'])

  const tagged = (key, sources) => sources.flatMap(([id, r]) => r[key].map(x => `${id}: ${x}`))
  graph = {
    fixes_applied: [...tagged('fixes_applied', A.sections.map((s, i) => [s.id, recs[i]])), ...tagged('fixes_applied', [['compile', compile]]), ...compile.ran.map(x => `compile ran: ${x}`)],
    spec_changes: specChanges,
    remaining_gaps: [...tagged('remaining_gaps', [['coverage', coverage], ...A.sections.map((s, i) => [s.id, recs[i]]), ['compile', compile], ['graph', writer]]), ...g.gaps],
    tasks: g.tasks, waves: g.waves, hot_files: g.hot_files,
  }
}

const inWaves = new Set(graph.waves.flat())
const orphans = graph.tasks.map(t => t.id).filter(id => !inWaves.has(id))
if (orphans.length) log(`Tasks missing from every wave: ${orphans.join(', ')}`)
if (missingResearch.length) return { ...incomplete([], []), graph }

return {
  status: 'complete',
  research: researchResults.map((r, i) => r && { key: research[i].key, doc: r.doc_path, confidence: r.confidence, open: r.open_questions }),
  sections: summaries.map(s => ({ id: s.id, path: s.path, tasks: s.tasks.length, risks: s.risks })),
  graph,
}
