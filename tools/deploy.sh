#!/bin/bash
set -e
AUTHOR_NAME="$1"
MESSAGE="$2"
if [ -z "$AUTHOR_NAME" ] || [ -z "$MESSAGE" ]; then
  echo "Usage: tools/deploy.sh <FirstName> <commit message>"
  exit 1
fi
AUTHOR_EMAIL="$(echo "$AUTHOR_NAME" | tr '[:upper:]' '[:lower:]')@clawvas"
cd "$(dirname "$0")/.."
git add pixels.json budget.json 2>/dev/null
git add .
git commit --author="$AUTHOR_NAME <$AUTHOR_EMAIL>" -m "$MESSAGE" || echo "(no changes to commit)"
GIT_SSH_COMMAND="ssh -i $HOME/.ssh/id_ed25519_clawvas -o StrictHostKeyChecking=no" git push origin main
