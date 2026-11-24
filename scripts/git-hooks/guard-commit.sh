#!/bin/sh
# Refuses direct commits on main and develop; merge commits (MERGE_HEAD present) are allowed.
branch=$(git symbolic-ref --short -q HEAD)
case "$branch" in
  main | develop)
    if [ ! -f "$(git rev-parse --git-path MERGE_HEAD)" ]; then
      echo "Direct commits on '$branch' are not allowed. Create a branch: feat/fix/chore from develop, hotfix from main." >&2
      exit 1
    fi
    ;;
esac
