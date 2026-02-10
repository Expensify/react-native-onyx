#!/bin/bash
#
# runFullComparison.sh — Run benchmarks for three configurations and generate HTML.
#
# Configs:
#   1. Baseline:   Rory-Benchmarks branch (no WriteBuffer, no workers, IDB only)
#   2. DM+IDB:     Rory-OnyxWasm branch with IDB storage forced
#   3. DM+SQLite:  Rory-OnyxWasm branch as-is (WriteBuffer + workers + SQLite)
#
# Output:
#   bench-results/baseline.json
#   bench-results/dm-idb.json
#   bench-results/dm-sqlite.json
#   bench-results.html
#
# Usage:
#   ./scripts/runFullComparison.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_DIR"

RESULTS_DIR="$REPO_DIR/bench-results"
BASELINE_BRANCH="Rory-Benchmarks"
WORK_BRANCH="Rory-OnyxWasm"

mkdir -p "$RESULTS_DIR"

# Save the current branch so we can return to it
ORIGINAL_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# ---------------------------------------------------------------------------
# Helper: run benchmarks and save JSON
# ---------------------------------------------------------------------------
run_bench() {
    local json_out="$1"
    echo "==> Running benchmarks → $json_out"
    npx vitest bench --run --config vitest.bench.config.ts --outputJson "$json_out" 2>&1
    echo "==> Done: $json_out"
}

# ---------------------------------------------------------------------------
# Cleanup on exit: always return to the original branch
# ---------------------------------------------------------------------------
cleanup() {
    echo ""
    echo "==> Returning to $ORIGINAL_BRANCH..."
    git checkout "$ORIGINAL_BRANCH" 2>/dev/null || true
    # Restore the platform index if we modified it
    git checkout -- lib/storage/platforms/index.ts 2>/dev/null || true
}
trap cleanup EXIT

# ---------------------------------------------------------------------------
# 1. Baseline (Rory-Benchmarks)
# ---------------------------------------------------------------------------
echo ""
echo "============================================"
echo "  Config 1/3: Baseline ($BASELINE_BRANCH)"
echo "============================================"

# Stash if dirty
STASH_CREATED=false
if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "==> Stashing uncommitted changes..."
    git stash push -m "runFullComparison: auto-stash"
    STASH_CREATED=true
fi

git checkout "$BASELINE_BRANCH"
npm ci --silent 2>/dev/null || npm install --silent
run_bench "$RESULTS_DIR/baseline.json"

# ---------------------------------------------------------------------------
# 2. DM+IDB (Rory-OnyxWasm with IDB storage forced)
# ---------------------------------------------------------------------------
echo ""
echo "============================================"
echo "  Config 2/3: DM+IDB ($WORK_BRANCH + IDB)"
echo "============================================"

git checkout "$WORK_BRANCH"
if $STASH_CREATED; then
    git stash pop
    STASH_CREATED=false
fi
npm ci --silent 2>/dev/null || npm install --silent

# Force IDB provider by replacing the platform index
printf 'import W from "../providers/IDBKeyValProvider";\nexport default W;\n' > lib/storage/platforms/index.ts
run_bench "$RESULTS_DIR/dm-idb.json"

# Restore the platform index
git checkout -- lib/storage/platforms/index.ts

# ---------------------------------------------------------------------------
# 3. DM+SQLite (Rory-OnyxWasm as-is)
# ---------------------------------------------------------------------------
echo ""
echo "============================================"
echo "  Config 3/3: DM+SQLite ($WORK_BRANCH)"
echo "============================================"

run_bench "$RESULTS_DIR/dm-sqlite.json"

# ---------------------------------------------------------------------------
# Generate HTML report
# ---------------------------------------------------------------------------
echo ""
echo "============================================"
echo "  Generating HTML report"
echo "============================================"

npx tsx scripts/generateBenchReport.ts \
    "$RESULTS_DIR/baseline.json" \
    "$RESULTS_DIR/dm-idb.json" \
    "$RESULTS_DIR/dm-sqlite.json" \
    --labels "Baseline (IDB only),DM+IDB,DM+SQLite" \
    --output bench-results.html \
    --open

echo ""
echo "Done! Results:"
echo "  JSON: $RESULTS_DIR/*.json"
echo "  HTML: bench-results.html"
