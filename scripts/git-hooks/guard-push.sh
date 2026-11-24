#!/bin/sh
# Reads git's pre-push stdin: "<local ref> <local sha> <remote ref> <remote sha>" per line.
# Prints "develop" when develop is being pushed, so pre-push can run the quality checks.
zero=0000000000000000000000000000000000000000
status=0

while read -r local_ref local_sha remote_ref remote_sha; do
  branch=${remote_ref#refs/heads/}
  if [ "$local_sha" = "$zero" ]; then
    case "$branch" in
      main | develop) echo "Deleting $branch is not allowed." >&2; status=1 ;;
    esac
    continue
  fi
  case "$remote_ref" in refs/heads/*) ;; *) continue ;; esac

  case "$branch" in
    main | develop | feat/?* | fix/?* | chore/?* | docs/?* | ci/?* | refactor/?* | test/?* | hotfix/?*) ;;
    *) echo "Branch '$branch' does not follow the pattern (feat|fix|chore|docs|ci|refactor|test|hotfix)/<topic>." >&2; status=1; continue ;;
  esac

  if [ "$remote_sha" != "$zero" ] && ! git merge-base --is-ancestor "$remote_sha" "$local_sha" 2>/dev/null; then
    echo "Non-fast-forward push to $branch refused. Pull and merge instead of rewriting history." >&2
    status=1
    continue
  fi

  case "$branch" in
    # main moves only by a merge whose merged side is the pushed origin/develop (release) or a
    # pushed origin/hotfix/* (hotfix). Creating main on an empty remote is allowed (bootstrap).
    main)
      [ "$remote_sha" = "$zero" ] && continue
      merged=$(git rev-parse -q --verify "$local_sha^2")
      allowed=no
      if [ -n "$merged" ]; then
        for ref in refs/remotes/origin/develop $(git for-each-ref --format='%(refname)' 'refs/remotes/origin/hotfix/'); do
          [ "$merged" = "$(git rev-parse -q --verify "$ref")" ] && allowed=yes
        done
      fi
      if [ "$allowed" = no ]; then
        echo "main accepts only a merge of origin/develop or of a pushed origin/hotfix/*:" >&2
        echo "  git switch main && git merge --no-ff develop   (push develop first)" >&2
        status=1
      fi
      ;;
    develop) echo develop ;;
  esac
done

exit "$status"
