#!/bin/bash
#
# benchAndReport.sh — Run benchmarks, generate a color-coded HTML report, and open it.
#
# This script supports three modes:
#
#   1. Single run (current code only):
#      ./scripts/benchAndReport.sh
#
#   2. Compare current branch vs a base branch:
#      ./scripts/benchAndReport.sh --compare main
#
#   3. Multi-config comparison (e.g. swapping storage providers):
#      Provide one or more --run flags with a label and an optional setup command.
#      ./scripts/benchAndReport.sh \
#        --run "Baseline" \
#        --run "DM+SQLite" \
#        --run "DM+IDB:printf 'import W from \"../providers/IDBKeyValProvider\";\nexport default W;\n' > lib/storage/platforms/index.ts"
#
# Options:
#   --compare <branch>    Compare current branch against <branch>
#   --run "<label>"       Run benchmarks with the given label (current code, no setup)
#   --run "<label>:<cmd>" Run <cmd> before benchmarking, label the column <label>
#   --output <path>       HTML output path (default: bench-results.html)
#   --no-open             Don't auto-open the report in a browser
#   -- <args>             Extra args passed to vitest bench
#
# Examples:
#   # Simple: run benchmarks on current code and generate report
#   ./scripts/benchAndReport.sh
#
#   # Compare against main
#   ./scripts/benchAndReport.sh --compare main
#
#   # Multi-config: baseline vs IDB-only
#   ./scripts/benchAndReport.sh \
#     --run "SQLite (default)" \
#     --run "IDB only:printf 'import W from \"../providers/IDBKeyValProvider\";\nexport default W;\n' > lib/storage/platforms/index.ts"

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_DIR"

OUTPUT="bench-results.html"
AUTO_OPEN=true
COMPARE_BRANCH=""
VITEST_ARGS=()

# Parallel arrays for multi-run mode
RUN_LABELS=()
RUN_SETUPS=()

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------

while [[ $# -gt 0 ]]; do
    case "$1" in
        --compare)
            COMPARE_BRANCH="$2"
            shift 2
            ;;
        --run)
            # Format: "Label" or "Label:setup-command"
            IFS=':' read -r label setup <<< "$2"
            RUN_LABELS+=("$label")
            RUN_SETUPS+=("${setup:-}")
            shift 2
            ;;
        --output)
            OUTPUT="$2"
            shift 2
            ;;
        --no-open)
            AUTO_OPEN=false
            shift
            ;;
        --)
            shift
            VITEST_ARGS=("$@")
            break
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

TMPDIR_BASE=$(mktemp -d)
JSON_FILES=()
LABELS=()
STASH_CREATED=false
ORIGINAL_BRANCH=""
MODIFIED_FILES_BACKUP=""

cleanup() {
    # Restore any backed-up files
    if [[ -n "$MODIFIED_FILES_BACKUP" && -d "$MODIFIED_FILES_BACKUP" ]]; then
        echo "==> Restoring modified files..."
        rsync -a "$MODIFIED_FILES_BACKUP/" "$REPO_DIR/" 2>/dev/null || true
    fi

    # Restore branch if we switched
    if [[ -n "$ORIGINAL_BRANCH" ]]; then
        git checkout "$ORIGINAL_BRANCH" 2>/dev/null || true
    fi
    if $STASH_CREATED; then
        git stash pop 2>/dev/null || true
    fi

    rm -rf "$TMPDIR_BASE"
}
trap cleanup EXIT

run_bench() {
    local json_out="$1"
    echo "==> Running benchmarks..."
    npx vitest bench --config vitest.bench.config.ts --outputJson "$json_out" ${VITEST_ARGS[@]+"${VITEST_ARGS[@]}"} 2>&1
    echo "==> Results saved to $json_out"
}

# ---------------------------------------------------------------------------
# Mode: Compare against a branch
# ---------------------------------------------------------------------------

if [[ -n "$COMPARE_BRANCH" ]]; then
    ORIGINAL_BRANCH=$(git rev-parse --abbrev-ref HEAD)
    echo "==> Comparing $ORIGINAL_BRANCH vs $COMPARE_BRANCH"

    # Stash if dirty
    if ! git diff --quiet || ! git diff --cached --quiet; then
        echo "==> Stashing uncommitted changes..."
        git stash push -m "benchAndReport: auto-stash"
        STASH_CREATED=true
    fi

    # Run baseline
    BASELINE_JSON="$TMPDIR_BASE/baseline.json"
    echo ""
    echo "==> Switching to $COMPARE_BRANCH for baseline..."
    git checkout "$COMPARE_BRANCH"
    npm ci --silent 2>/dev/null || npm install --silent
    run_bench "$BASELINE_JSON"
    JSON_FILES+=("$BASELINE_JSON")
    LABELS+=("$COMPARE_BRANCH")

    # Run current
    CURRENT_JSON="$TMPDIR_BASE/current.json"
    echo ""
    echo "==> Switching back to $ORIGINAL_BRANCH..."
    git checkout "$ORIGINAL_BRANCH"
    if $STASH_CREATED; then
        git stash pop
        STASH_CREATED=false
    fi
    npm ci --silent 2>/dev/null || npm install --silent
    run_bench "$CURRENT_JSON"
    JSON_FILES+=("$CURRENT_JSON")
    LABELS+=("$ORIGINAL_BRANCH")

# ---------------------------------------------------------------------------
# Mode: Multi-config runs
# ---------------------------------------------------------------------------

elif [[ ${#RUN_LABELS[@]} -gt 0 ]]; then
    for i in "${!RUN_LABELS[@]}"; do
        label="${RUN_LABELS[$i]}"
        setup="${RUN_SETUPS[$i]}"
        json="$TMPDIR_BASE/run-$i.json"

        echo ""
        echo "============================================"
        echo "  Config: $label"
        echo "============================================"

        # Back up files that setup might modify (for restoration)
        if [[ -n "$setup" ]]; then
            if [[ -z "$MODIFIED_FILES_BACKUP" ]]; then
                MODIFIED_FILES_BACKUP="$TMPDIR_BASE/backup"
                mkdir -p "$MODIFIED_FILES_BACKUP"
            fi
            # Snapshot current state of lib/storage/platforms/
            rsync -a --relative lib/storage/platforms/ "$MODIFIED_FILES_BACKUP/" 2>/dev/null || true

            echo "==> Running setup: $setup"
            eval "$setup"
        fi

        run_bench "$json"
        JSON_FILES+=("$json")
        LABELS+=("$label")

        # Restore after each run
        if [[ -n "$setup" && -n "$MODIFIED_FILES_BACKUP" ]]; then
            echo "==> Restoring files after config run..."
            rsync -a "$MODIFIED_FILES_BACKUP/" "$REPO_DIR/" 2>/dev/null || true
        fi
    done

# ---------------------------------------------------------------------------
# Mode: Single run (default)
# ---------------------------------------------------------------------------

else
    SINGLE_JSON="$TMPDIR_BASE/current.json"
    run_bench "$SINGLE_JSON"
    JSON_FILES+=("$SINGLE_JSON")
    LABELS+=("current")
fi

# ---------------------------------------------------------------------------
# Generate HTML report
# ---------------------------------------------------------------------------

echo ""
echo "==> Generating HTML report..."

LABEL_ARG=$(IFS=','; echo "${LABELS[*]}")
OPEN_FLAG=""
if $AUTO_OPEN; then
    OPEN_FLAG="--open"
fi

npx tsx "$SCRIPT_DIR/generateBenchReport.ts" \
    "${JSON_FILES[@]}" \
    --labels "$LABEL_ARG" \
    -o "$OUTPUT" \
    ${OPEN_FLAG:+"$OPEN_FLAG"}

echo ""
echo "Done! Report: $OUTPUT"
