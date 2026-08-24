#!/bin/sh
# Push the current branch to origin.
#
# Why this exists
# ---------------
# /Users/Shared/DATAD is shared between the `aaruraanat` and `digitaldon`
# accounts. The GitHub credential lives in aaruraanat's login keychain, so a
# push from any other account fails with:
#
#   fatal: could not read Username for 'https://github.com': Device not configured
#
# Run this from the aaruraanat account, in a normal interactive Terminal
# (the keychain will not unlock from a background process):
#
#   sh push-branch.sh

set -e

cd "/Users/Shared/DATAD"

BRANCH=$(git rev-parse --abbrev-ref HEAD)

echo "==> Running as: $(id -un)"
echo "==> Branch:     $BRANCH"
echo

echo "==> Commits about to be pushed:"
git log --oneline "origin/$BRANCH..HEAD" || true
echo

echo "==> Pushing to origin/$BRANCH ..."
git push origin "$BRANCH"
echo
echo "==> Done. Remote is now at:"
git log --oneline -1 "origin/$BRANCH"
