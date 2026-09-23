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
//   context:     '<project brief: goal, toolchain, binding rules the planners need>',
//   research:    [{ key, title, ask }],                   // optional
//   sections:    [{ id, scope, needs: [researchKey], dependsOn: [sectionId] }],
//   done:        { research: { key: result }, sections: { id: result } },  // results finished in an earlier run
// }
const A = args
const done = A.done || {}
const doneResearch = done.research || {}
const doneSections = done.sections || {}
const research = A.research || []
const q = p => `"${p}"`

const COMMON = `
${A.context}
Repo root: ${q(A.repo)} (always quote paths).
Binding documents, read first: spec ${q(A.spec)} and master plan ${q(A.plan)}. Its Shared Contracts, Global Constraints and Review Focus are binding: use the exact names and types; add members, never rename or re-type.
Research docs: ${q(A.researchDir)}. Scratch space may vanish (a reboot wipes /tmp): anything a later agent needs goes in a committed doc or a recipe that rebuilds it.
Hard rules: never git --no-verify or any hook skip; a checkbox is ticked only with its artifact (command output you saw); batch verification (make every edit, then one build + lint pass; parameterized tests over collections; one UI run that captures every screenshot).
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
const researchPromises = {}
for (const r of research) {
  researchPromises[r.key] = doneResearch[r.key]
    ? Promise.resolve(doneResearch[r.key])
    : agent(`${COMMON}
TASK (research; read-only except your one doc): ${r.title}
${r.ask}
Work empirically: back every claim with code or commands you actually ran. Put reusable, verified code in the doc.
Write findings to ${q(`${A.researchDir}/${r.key}.md`)}. Do not commit; the orchestrator commits.`,
      { label: `research:${r.key}`, phase: 'Research', schema: RESEARCH_SCHEMA })
}

function sectionPrompt(s, researchDeps, sectionDeps) {
  const rb = researchDeps.map(([k, d]) => d
    ? `- ${k}: ${d.doc_path} (confidence ${d.confidence})\n  ${d.summary.replace(/\n/g, '\n  ')}\n  open: ${d.open_questions.join(' | ')}`
    : `- ${k}: RESEARCH FAILED; say what you assumed`).join('\n')
  const sb = sectionDeps.filter(([, d]) => d).map(([id, d]) => `- ${id}: ${d.path}`).join('\n')
  return `${COMMON}
TASK: Write the implementation plan section "${s.id}" to ${q(`${A.sectionsDir}/${s.id}.md`)}.
Scope (binding decisions): ${s.scope}
${rb ? `Research to read and build on:\n${rb}` : ''}
${sb ? `Sections this one builds on (read them; use their exact names):\n${sb}` : ''}
Follow the writing-plans format exactly (read ${q(A.writingPlans)}): each task has Files, Interfaces (Consumes / Produces with exact signatures) and checkbox steps: failing test with real code -> run it (exact command, expected failure) -> complete implementation code -> run (expected pass) -> lint/hooks pass -> commit (exact command, conventional message ending with '${A.trailer}'). No placeholders, no "similar to Task N". Task ids ${s.id}-T1, ${s.id}-T2, ...; depends_on lists ids from any section.
Name every file each task touches. Verify APIs you are unsure of with a scratch probe outside the repo. Write only the plan; do not implement or commit.`
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
const missing = A.sections.filter((s, i) => !sectionResults[i]).map(s => s.id)
if (missing.length) {
  log(`Planning failed for ${missing.join(', ')}; critic skipped`)
  return { stopped: 'planning failed', missing, sections: sectionResults, research: researchResults }
}

phase('Critique')
const summaries = A.sections.map((s, i) => ({ id: s.id, ...sectionResults[i] }))
const graph = await agent(`${COMMON}
TASK: You are the plan critic. The sections were written in parallel by different agents; make them one coherent, executable plan.
Read the master plan, the spec, every file in ${q(A.sectionsDir)} fully (in chunks if large) and the research docs.
Section summaries: ${JSON.stringify(summaries)}
Check and FIX IN PLACE (edit section files; edit the master plan only to record contract additions and the section table; edit the spec only where research proved it wrong, and list each such change):
1. Consumes <-> produces: every consumed name is produced, with the identical signature, by a task ordered earlier. Pick one name and edit every section that disagrees.
2. Contracts: nothing renames or re-types a Shared Contract item; additions from different sections don't collide; edits to shared switch/dispatch code are ordered so the code compiles after every task.
3. Spec coverage: every spec requirement maps to a task; add missing tasks to the owning section.
4. Placeholder scan: TBD, TODO, "similar to", "add error handling", sketches instead of code. Fix them.
5. Review Focus: each item has a concrete test in an owning task.
6. Tooling: every run command the tasks use exists (task runner entries, scripts); add missing ones to the task that owns tooling.
7. Compile check: assemble the plans' code in a scratch copy of the repo outside it (apply each task's edits in graph order), build and test it, and fix the plans where it breaks. Report what you ran and its result.
8. Execution graph: every task id -> depends-on ids, then waves where tasks in one wave touch disjoint files. List files many tasks edit ("hot files") and serialize those tasks unless the edits are append-only and trivially mergeable; say which. Write it as "## Execution Graph" at the end of the master plan.
Do not commit. Return the graph: each task with the plan file holding its "### Task <id>" block.`,
  { label: 'critic', phase: 'Critique', schema: GRAPH_SCHEMA })

if (graph) {
  const inWaves = new Set(graph.waves.flat())
  const orphans = graph.tasks.map(t => t.id).filter(id => !inWaves.has(id))
  if (orphans.length) log(`Tasks missing from every wave: ${orphans.join(', ')}`)
}

return {
  research: researchResults.map((r, i) => r && { key: research[i].key, doc: r.doc_path, confidence: r.confidence, open: r.open_questions }),
  sections: summaries.map(s => ({ id: s.id, path: s.path, tasks: s.tasks.length, risks: s.risks })),
  graph,
}
