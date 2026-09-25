export const meta = {
  name: 'plan-critic',
  description: 'Research unknowns, write per-section TDD plans against shared contracts in parallel, then have a critic reconcile them into one plan with an execution graph',
  whenToUse: 'After a spec and a master plan with Shared Contracts exist; before a wave build',
  phases: [
    { title: 'Research', detail: 'one agent per unknown; findings land in committed docs' },
    { title: 'Write', detail: 'one planner per section, writing against the shared contracts' },
    { title: 'Critique', detail: 'consumes/produces, placeholders, spec coverage, compile check, execution graph' },
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
//   done:        { research: { key: result }, sections: { id: result }, critic: graph },  // optional; merged over the ledger
//   argsScript:  '<abs path of a script that returns these args>',  // optional; for args too big to pass inline
// }
// Relaunching with the same args resumes: the ledger marks what finished, leftover prototypes become hints.
const A = args.argsScript ? { ...(await workflow({ scriptPath: args.argsScript })), ...args } : args
if (!A.ledger || !A.mergeLock) throw new Error('args.ledger and args.mergeLock are required: finished results must be committed as they land')
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

phase('Research')
const L = await loadLedger(`${A.scratch}/.ledger.workflow.js`)
const fromLedger = kind => Object.fromEntries(L.entries.filter(e => e.kind === kind).map(e => [e.id, e.result]))
const done = A.done || {}
const doneResearch = { ...fromLedger('research'), ...done.research }
const doneSections = { ...fromLedger('section'), ...done.sections }
const doneCritic = done.critic || fromLedger('critic').graph
const scratchLeft = new Set(L.scratch)
const hintFor = s => s.hint || (scratchLeft.has(s.id) ? `${A.scratch}/${s.id}` : '')
log(`Ledger: ${Object.keys(doneResearch).length} research and ${Object.keys(doneSections).length} sections already done${doneCritic ? ', critic done' : ''}`)

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
  log(`INCOMPLETE: missing research [${missingResearch.join(', ')}], sections [${sections.join(', ')}]${critic ? ', critic' : ''}. Relaunch with the same args; the ledger skips what finished.`)
  return {
    status: 'INCOMPLETE',
    resume: { missing: { research: missingResearch, sections, critic }, ledger: A.ledger, relaunch: 'same scriptPath and args; finished work is read from the ledger, leftover prototypes become hints' },
    research: researchResults, sections: sectionResults,
  }
}
if (missing.length) return incomplete(missing, true)

phase('Critique')
const summaries = A.sections.map((s, i) => ({ id: s.id, ...sectionResults[i] }))
const graph = doneCritic || await agent(`${COMMON}
TASK: You are the plan critic. The sections were written in parallel by different agents; make them one coherent, executable plan.
Read the master plan, the spec, every file in ${q(A.sectionsDir)} fully (in chunks if large) and the research docs.
Section summaries: ${JSON.stringify(summaries)}
You have authority to fix, not just report. FIX IN PLACE: edit section files; edit the master plan only to record contract additions (never renames) and the section table; edit the spec only where research proved it wrong, and list each such change in spec_changes for the user.
1. Consumes <-> produces: every consumed name is produced, with the identical signature, by a task ordered earlier. Pick one name and edit every section that disagrees.
2. Contracts: nothing renames or re-types a Shared Contract item; additions from different sections don't collide; edits to shared switch/dispatch code are ordered so the code compiles after every task.
3. Spec coverage: every spec requirement maps to a task; add missing tasks to the owning section.
4. Placeholder scan: TBD, TODO, "similar to", "add error handling", sketches instead of code. Fix them.
5. Review Focus: each item has a concrete test in an owning task.
6. Tooling: every run command the tasks use exists (task runner entries, scripts); add missing ones to the task that owns tooling.
7. Compile check: each planner proved its own section in ${q(A.scratch)}; you prove them together. Assemble every section's code in one scratch copy of the repo (apply each task's edits in graph order), build, lint and test it, and fix the plans where it breaks. Report what you ran and its result.
8. Execution graph: every task id -> depends-on ids, then waves where tasks in one wave touch disjoint files. List files many tasks edit ("hot files") and serialize those tasks unless the edits are append-only and trivially mergeable; say which. Write it as "## Execution Graph" at the end of the master plan.
Return the graph: each task with the plan file holding its "### Task <id>" block.
${record('critic', 'graph', [A.sectionsDir, A.plan, A.spec])}`,
  { label: 'critic', phase: 'Critique', schema: GRAPH_SCHEMA })

if (graph) {
  const inWaves = new Set(graph.waves.flat())
  const orphans = graph.tasks.map(t => t.id).filter(id => !inWaves.has(id))
  if (orphans.length) log(`Tasks missing from every wave: ${orphans.join(', ')}`)
}
if (!graph || missingResearch.length) return { ...incomplete([], !graph), graph }

return {
  status: 'complete',
  research: researchResults.map((r, i) => r && { key: research[i].key, doc: r.doc_path, confidence: r.confidence, open: r.open_questions }),
  sections: summaries.map(s => ({ id: s.id, path: s.path, tasks: s.tasks.length, risks: s.risks })),
  graph,
}
