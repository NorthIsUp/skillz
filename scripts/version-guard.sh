#!/bin/sh
# Forgetting to bump is no longer a PR failure — auto-bump-plugins.sh patch-bumps
# on main. What CI still can't fix for you is a hand-edited version that agrees
# with neither file: releases are tagged off marketplace.json, so a plugin.json
# that disagrees ships a lie.
#
# One jq over every manifest; it prints the report and exits 1 on any FAIL.
exec jq -rn --slurpfile market .claude-plugin/marketplace.json '
  [inputs | {file: input_filename} + .] as $all
  | ($all | map(select(.file | endswith("/.codex-plugin/plugin.json")) | {key: (.file | sub("/.codex-plugin/plugin.json$"; "")), value: .version})
    | from_entries) as $codex
  | [ $all[] | select(.file | endswith("/.claude-plugin/plugin.json"))
      | .name as $n | (.version // "") as $v
      | ([$market[0].plugins[] | select(.name == $n) | .version // ""] | first // "") as $mv
      | $codex[.file | sub("/.claude-plugin/plugin.json$"; "")] as $cv
      | if $v == "" then "[\($n)] FAIL: plugin.json has no version"
        elif $mv == "" then "[\($n)] FAIL: no entry in .claude-plugin/marketplace.json"
        elif $v != $mv then "[\($n)] FAIL: plugin.json (\($v)) != marketplace.json (\($mv))\n  run: mise run bump \($n) patch"
        elif $cv != null and $cv != $v then "[\($n)] FAIL: .codex-plugin/plugin.json != plugin.json (\($v))\n  run: mise run bump \($n) patch"
        else "[\($n)] \($v) ok" end ] as $report
  | ($report[] | .), if any($report[]; contains("FAIL")) then "" | halt_error(1) else empty end
' plugins/*/.claude-plugin/plugin.json plugins/*/.codex-plugin/plugin.json
