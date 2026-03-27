#!/bin/bash
#
# Re-generates API docs and verifies that there is no diff,
# because that would indicate that the PR author forgot to run `npm run build:docs`
# and commit the updated API.md and API-INTERNAL.md files.

declare -r GREEN='\033[0;32m'
declare -r RED='\033[0;31m'
declare -r NC='\033[0m'

printf '\nRebuilding API docs...\n'
npm run build:docs

DIFF_OUTPUT=$(git diff --exit-code API.md API-INTERNAL.md)
EXIT_CODE=$?

if [[ EXIT_CODE -eq 0 ]]; then
    echo -e "${GREEN}API docs are up to date!${NC}"
    exit 0
else
    echo -e "${RED}Error: Diff found when API docs were rebuilt. Did you forget to run \`npm run build:docs\` after making changes?${NC}"
    echo "$DIFF_OUTPUT"
    exit 1
fi
