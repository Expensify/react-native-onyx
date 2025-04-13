#!/bin/bash
#
# Used to precompile all Github Action node.js scripts using ncc.
# This bundles them with their dependencies into a single executable node.js script.

# In order for this script to be safely run from anywhere, we cannot use the raw relative path '../actions'.
ACTIONS_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../actions/javascript" &>/dev/null && pwd)"
readonly ACTIONS_DIR

# This stores all the process IDs of the ncc commands so they can run in parallel
ASYNC_BUILDS=()

# Build all the actions in the background
for ACTION in "$ACTIONS_DIR"/*/*.ts; do
    ACTION_DIR=$(dirname "$ACTION")
    npx ncc build --transpile-only --external encoding "$ACTION" -o "$ACTION_DIR" &
    ASYNC_BUILDS+=($!)
done

# Wait for the background build to finish
EXIT_CODE=0
for PID in "${ASYNC_BUILDS[@]}"; do
    if ! wait "$PID"; then
        EXIT_CODE=1
    fi
done

# Prepend this note at the top of all compiled files as a warning to devs.
readonly NOTE_DONT_EDIT='/**
 * NOTE: This is a compiled file. DO NOT directly edit this file.
 */
'
for OUTPUT_FILE in "$ACTIONS_DIR"/*/index.js; do
    echo "$NOTE_DONT_EDIT$(cat "$OUTPUT_FILE")" > "$OUTPUT_FILE"
done

if [[ EXIT_CODE -ne 0 ]]; then
    echo "❌ One or more builds failed"
    exit 1
fi

echo "✅ All builds succeeded"
