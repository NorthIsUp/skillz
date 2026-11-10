---
name: watch-ci
description: Waiting on PR CI after a push — stream each check as it finishes with a Monitor loop, never wait for the whole run
alwaysApply: true
---

# Watch CI one check at a time

After pushing to a PR, arm a Monitor that reports each check as soon as it
finishes, and each failure with its error line. Don't hand CI to a subagent
that reports once the whole run is done, and don't block on
`gh pr checks --watch`. A shard that dies 20 seconds in should reach you then,
not when the slowest job finishes 15 minutes later.

`gh pr checks --watch --fail-fast` gives up early too: right after a push it
can exit before any check exists. The loop below waits until checks appear.

```bash
pr=<number>; nwo=$(gh repo view --json nameWithOwner -q .nameWithOwner)
seen=""
while true; do
  s=$(gh pr checks "$pr" --json name,bucket,link 2>/dev/null || echo '[]')
  while IFS=$'\t' read -r name bucket link; do
    key="$name|$bucket|$link"   # link holds the job id, so a rerun reports again
    case "$seen" in *"$key"*) continue;; esac
    seen="$seen
$key"
    if [ "$bucket" = fail ] || [ "$bucket" = cancel ]; then
      job=$(grep -oE 'job/[0-9]+' <<<"$link" | cut -d/ -f2)
      why=$([ -n "$job" ] && gh api "repos/$nwo/actions/jobs/$job/logs" --allow-escape-sequences 2>/dev/null \
        | sed 's/\x1b\[[0-9;]*m//g' | grep -E '##\[error\]|FAILED|Error:|Aborted|AssertionError' \
        | grep -v 'Process completed' | tail -3 | cut -c30-230 | tr '\n' ' ')
      echo "FAIL $name :: ${why:-$link}"   # non-Actions checks have no job log
    fi
  done < <(jq -r '.[] | select(.bucket!="pending" and .bucket!="skipping") | [.name,.bucket,.link] | @tsv' <<<"$s")
  jq -e 'length>0 and all(.bucket!="pending")' <<<"$s" >/dev/null && {
    echo "DONE pass=$(jq '[.[]|select(.bucket=="pass")]|length' <<<"$s") fail=$(jq '[.[]|select(.bucket=="fail")]|length' <<<"$s")"
    break; }
  sleep 30
done
```

- Only failures and the final `DONE` line are events, so a passing check
  sends no message. Add an `else echo "PASS $name"` branch if every result
  should be reported.
- A failing job's log can be read as soon as that job ends, even while the
  rest of the run is still going. Start fixing then.
- `gh run rerun <run> --failed` only works once the whole run has completed.
  Diagnose early; rerun when the run ends. A rerun gets a new job id, so the
  loop reports it again.
- Re-arm the Monitor when it expires and checks are still pending.
- No Monitor tool (another harness)? Run the same loop as a background shell
  and read its output on completion. The `ci-watcher` agent is the fallback
  when neither works.
