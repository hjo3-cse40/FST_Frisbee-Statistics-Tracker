# merge_branch.sh
#!/bin/bash
# Usage: ./merge_branch.sh <short-name>
BRANCH="feature/$1"

echo "Switching to main branch..."
git switch main || exit 1

echo "Updating main branch..."
git pull --rebase origin main || exit 1

echo "Merging $BRANCH into main..."
git merge "$BRANCH" || exit 1

echo "Pushing updated main to remote..."
git push || exit 1

echo "Deleting local branch $BRANCH..."
git branch -d "$BRANCH" || exit 1

echo "Deleting remote branch $BRANCH..."
git push origin --delete "$BRANCH" || exit 1

echo "Merge and cleanup complete."