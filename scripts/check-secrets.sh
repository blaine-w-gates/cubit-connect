#!/bin/bash

# A strict pre-commit hook to prevent known API keys or connection strings
# from being committed and potentially ingested by AI models (Chat Leakage)

# Colors for output
RED='\033[0;31m'
NC='\033[0m'

# The regex patterns to search for.
# Matches common OpenAI/Gemini/Anthropic keys (sk-), JWTs (ey), and Postgres URLs
PATTERNS="(\"|')?(sk-[a-zA-Z0-9]{20,})|(\"|')?(AIza[a-zA-Z0-9_\\-]{35})|(\"|')?(eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)|(postgres:\/\/[a-zA-Z0-9]+:)"

# Get staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -v "check-secrets.sh" | grep -v package-lock.json)

if [ -z "$STAGED_FILES" ]; then
  exit 0
fi

SECRETS_FOUND=0

for FILE in $STAGED_FILES; do
  # Check if the file contains any of the patterns
  if git show ":$FILE" | egrep -q -E "$PATTERNS"; then
    echo -e "${RED}❌ ERROR: Potential secret detected in $FILE ${NC}"
    # Show the exact line (without coloring the match to avoid weird escape sequences in CI)
    git show ":$FILE" | egrep -n -E "$PATTERNS"
    SECRETS_FOUND=1
  fi
done

if [ $SECRETS_FOUND -eq 1 ]; then
  echo ""
  echo -e "${RED}Commit rejected.${NC}"
  echo "You must remove these hardcoded secrets. Use environment variables (.env) instead."
  echo "If this is a false positive, you can bypass with: git commit --no-verify"
  exit 1
fi

exit 0
