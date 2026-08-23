#!/bin/sh
# Fix the .git object-directory permissions in this repo.
#
# Why this exists
# ---------------
# /Users/Shared/DATAD is owned by the `aaruraanat` account, but it also gets
# worked on from `digitaldon`. Both are in the `staff` group, and most of
# .git/objects is group-writable (0775) — but a handful of fanout directories
# were created 0755, without the group-write bit.
#
# Git writes a temp file INSIDE the fanout directory before renaming the object
# into place, so any object hashing into one of those directories fails with:
#
#   error: insufficient permission for adding an object to repository database
#
# Retrying does not help. Blob hashes are content-deterministic, so the same
# file lands in the same unwritable directory every time.
#
# How to run
# ----------
#   As aaruraanat (owner, no password needed):   sh fix-git-perms.sh
#   As anyone else (will prompt for password):   sudo sh fix-git-perms.sh

set -e

REPO="/Users/Shared/DATAD"
cd "$REPO"

echo "==> Repo: $REPO"
echo "==> Running as: $(id -un)"
echo

echo "==> Directories missing group-write BEFORE:"
find .git/objects -maxdepth 1 -type d ! -perm -g+w || true
echo

echo "==> Adding group-write across .git ..."
chmod -R g+w .git
echo "    done."
echo

# Make git create every FUTURE object directory group-writable, so this script
# never needs to be run a second time.
echo "==> Setting core.sharedRepository=group ..."
git config core.sharedRepository group
echo "    done."
echo

echo "==> Directories missing group-write AFTER (should be empty):"
remaining=$(find .git/objects -maxdepth 1 -type d ! -perm -g+w)
if [ -z "$remaining" ]; then
  echo "    (none) — permissions are clean, commits will work."
else
  echo "$remaining"
  echo
  echo "    STILL BLOCKED. The chmod could not reach these — you are probably"
  echo "    not the owner. Re-run this script as aaruraanat, or with sudo."
  exit 1
fi
