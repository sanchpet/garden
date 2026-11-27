#!/usr/bin/env bash
# Lists upstream Quartz commits after the one in UPSTREAM as a markdown issue body.
# Usage: report.sh <upstream-ref> <out.md>; prints the number of new commits.
set -euo pipefail
ref=$1 out=$2
base=$(cat UPSTREAM)
repo=https://github.com/jackyzha0/quartz
commits=$(git rev-list --reverse --no-merges "$base..$ref")
count=$(printf "%s" "$commits" | grep -c . || true)
{
  echo "Quartz \`v5\` has $count new commits since \`${base:0:7}\` (the commit in \`UPSTREAM\`)."
  echo
  echo "Take what the garden needs with \`git diff <sha>^ <sha> | git apply -3\`, skip the rest, then move \`UPSTREAM\` to the last reviewed commit; that closes this issue. Never merge upstream: it brings its history back."
  echo
  for c in $commits; do
    dirs=$(git show --format= --name-only "$c" | awk -F/ 'NF>2{print $1"/"$2} NF<=2{print $1}' | sort -u | head -6 | paste -sd ' ' -)
    git show -s --format="- [\`%h\`]($repo/commit/%H) %as %s" "$c" | sed 's/[[:space:]]*$//'
    echo "  <sub>${dirs}</sub>"
  done
} >"$out"
echo "$count"
