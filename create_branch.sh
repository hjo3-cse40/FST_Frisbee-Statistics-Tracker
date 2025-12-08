#!/bin/bash
# Usage: ./create_branch.sh <short-name>
if [ -z "$1" ]; then
  echo "Error: No branch name provided."
  echo "Usage: ./create_branch.sh <short-name>"
  exit 1
fi

BRANCH="feature/$1"

echo "Creating and switching to $BRANCH..."

# Usage: ./create_branch.sh <short-name>
BRANCH="feature/$1"

git switch -c "$BRANCH"
git push -u origin "$BRANCH"