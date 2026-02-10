#!/bin/bash
#
# compareBenchmarks.sh — Compare benchmark results between the current branch
# and a base branch (defaults to "main").
#
# Usage:
#   ./scripts/compareBenchmarks.sh [base-branch] [-- vitest args...]
#
# Examples:
#   ./scripts/compareBenchmarks.sh                          # Compare against main
#   ./scripts/compareBenchmarks.sh release                  # Compare against 'release' branch
#   ./scripts/compareBenchmarks.sh main -- benchmarks/set   # Only run set benchmarks
#

set -euo pipefail

BASELINE_FILE=".bench-baseline.json"
BASE_BRANCH="${1:-main}"

# Collect extra vitest args (everything after --)
EXTRA_ARGS=()
shift || true
if [[ "${1:-}" == "--" ]]; then
    shift
    EXTRA_ARGS=("$@")
fi

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

CURRENT_BRANCH=""
STASH_CREATED=false

cleanup() {
    echo ""
    echo "==> Cleaning up..."
    if [[ -n "$CURRENT_BRANCH" ]]; then
        git checkout "$CURRENT_BRANCH" 2>/dev/null || true
    fi
    if $STASH_CREATED; then
        echo "==> Restoring stashed changes..."
        git stash pop 2>/dev/null || true
    fi
    rm -f "$BASELINE_FILE"
}

trap cleanup EXIT

# ---------------------------------------------------------------------------
# 1. Record current state
# ---------------------------------------------------------------------------

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "==> Current branch: $CURRENT_BRANCH"
echo "==> Base branch:    $BASE_BRANCH"
echo ""

# Stash uncommitted changes if any
if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "==> Stashing uncommitted changes..."
    git stash push -m "compareBenchmarks: auto-stash"
    STASH_CREATED=true
fi

# ---------------------------------------------------------------------------
# 2. Run baseline on base branch
# ---------------------------------------------------------------------------

echo ""
echo "==> Switching to base branch '$BASE_BRANCH'..."
git checkout "$BASE_BRANCH"

echo "==> Installing dependencies for baseline..."
npm ci --silent 2>/dev/null || npm install --silent

echo ""
echo "==> Running baseline benchmarks on '$BASE_BRANCH'..."
npx vitest bench --run --config vitest.bench.config.ts --outputJson "$BASELINE_FILE" "${EXTRA_ARGS[@]}" || {
    echo "ERROR: Baseline benchmarks failed on '$BASE_BRANCH'"
    exit 1
}

echo ""
echo "==> Baseline results saved to $BASELINE_FILE"

# ---------------------------------------------------------------------------
# 3. Switch back and run comparison
# ---------------------------------------------------------------------------

echo ""
echo "==> Switching back to '$CURRENT_BRANCH'..."
git checkout "$CURRENT_BRANCH"

if $STASH_CREATED; then
    echo "==> Restoring stashed changes..."
    git stash pop
    STASH_CREATED=false
fi

echo "==> Installing dependencies for current branch..."
npm ci --silent 2>/dev/null || npm install --silent

echo ""
echo "============================================================"
echo "  BENCHMARK COMPARISON: $BASE_BRANCH → $CURRENT_BRANCH"
echo "============================================================"
echo ""

npx vitest bench --run --config vitest.bench.config.ts --compare "$BASELINE_FILE" "${EXTRA_ARGS[@]}" || {
    echo "ERROR: Benchmarks failed on '$CURRENT_BRANCH'"
    exit 1
}

echo ""
echo "==> Comparison complete!"
