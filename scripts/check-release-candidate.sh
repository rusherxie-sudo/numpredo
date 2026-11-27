#!/usr/bin/env bash
# Local quality gate for one exact, committed candidate. Never publishes.
set -euo pipefail
expected=${1:?Usage: bash scripts/check-release-candidate.sh FULL_SHA}
[[ "$expected" =~ ^[0-9a-f]{40}$ ]] || { echo 'Expected a full commit SHA' >&2; exit 1; }
[[ -z "${CF_PAGES_COMMIT_SHA:-}" || "$CF_PAGES_COMMIT_SHA" == "$expected" ]] || { echo 'Pages commit does not match candidate' >&2; exit 1; }
verify_candidate() {
  [[ "$(git rev-parse HEAD)" == "$expected" ]] || { echo 'Candidate HEAD changed' >&2; exit 1; }
  local candidate_status
  candidate_status=$(git status --porcelain=v1 --untracked-files=all) || { echo 'Failed to read candidate git status' >&2; exit 1; }
  [[ -z "$candidate_status" ]] || { echo 'Candidate has uncommitted changes' >&2; exit 1; }
}
verify_candidate
printf 'Quality gate SHA: %s\n' "$expected"
node --version
npm --version
npm run check:daily
npm run check:public-puzzles
npm run check
npm run demo
node --test scripts/np01/contracts.test.ts scripts/overnight/*.test.* scripts/pwa/cohort.test.mjs scripts/verify-daily-deployment.test.mjs
python3 scripts/pwa/report.test.py
npm run build
node --test scripts/np01/output.test.ts
verify_candidate
if [[ -n "${CF_PAGES_COMMIT_SHA:-}" ]]; then
  printf '%s\n' "$expected" > dist/deployment-sha.txt
fi
printf 'Quality gate passed for %s\n' "$expected"
