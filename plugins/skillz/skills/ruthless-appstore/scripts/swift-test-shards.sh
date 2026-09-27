#!/bin/sh
# `swift test`, one process per shard of suites. A test target with default MainActor isolation runs
# every Swift Testing test on one actor, so a single `swift test` is serial (PixKidz: 306s -> 136s).
# usage: swift-test-shards.sh <package-path> <TestModule>   env: SHARDS (default 2 x cores)
set -eu
cd "${1:?usage: swift-test-shards.sh <package-path> <TestModule>}"
mod=${2:?test module, e.g. KidPixEngineTests}

swift build --build-tests
swift test list --skip-build > .build/tests.txt
# Suites vary widely in cost; two shards per core lets the scheduler even out the slow ones.
n=${SHARDS:-$(( $(sysctl -n hw.ncpu) * 2 ))}
out=$(mktemp -d)
sed -nE "s#^$mod\\.([^/]+)/.*#\\1#p" .build/tests.txt | sort -u \
  | awk -v n="$n" -v d="$out" '{ print > (d "/" (NR % n)) }'

pids=
for f in "$out"/*; do
  # --ignore-lock: the shards only read the built products, but each would otherwise wait on .build's lock.
  swift test --skip-build --ignore-lock --filter "$mod\\.($(paste -sd'|' "$f"))/" > "$f.log" 2>&1 &
  pids="$pids $!"
done
fail=0
for p in $pids; do wait "$p" || fail=1; done

for f in "$out"/*.log; do
  grep -E '^(✘|.*Test run with)' "$f" || { echo "no summary in $f:"; tail -40 "$f"; fail=1; }
done
[ "$fail" = 0 ] || { cat "$out"/*.log | grep -E '✘|error' | head -200; exit 1; }

# A filter typo would drop tests silently; every listed test must have run in some shard.
want=$(grep -c "^$mod\\." .build/tests.txt)
got=$(cat "$out"/*.log | sed -nE 's/.*Test run with ([0-9]+) tests?.*/\1/p' | awk '{ s += $1 } END { print s + 0 }')
echo "$n shards ran $got of $want tests"
[ "$got" = "$want" ]
