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

git add pixels.json
git commit --author="$AUTHOR_NAME <$AUTHOR_EMAIL>" -m "$MESSAGE"
GIT_SSH_COMMAND="ssh -i /workspace/extra/ssh-clawvas -o StrictHostKeyChecking=no" git push origin main
