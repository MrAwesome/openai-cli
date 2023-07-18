#!/bin/bash

set -euxo pipefail

# Default values
YARN_VERSION_FLAG='--patch'
BUMP_VERSION=true
GIT_PUSH=true
NPM_PUBLISH=true

# if $1 is empty, echo lol (the check should be set -e safe)
while [ ! -z "${1:-}" ]; do
    case "${1:-}" in
        --major)
            YARN_VERSION_FLAG='--major'
            shift
            ;;
        --minor)
            YARN_VERSION_FLAG='--minor'
            shift
            ;;
        --patch)
            YARN_VERSION_FLAG='--patch'
            shift
            ;;
        --no-push)
            GIT_PUSH=false
            shift
            ;;
        --no-publish)
            NPM_PUBLISH=false
            shift
            ;;
        --bump-version)
            BUMP_VERSION=true
            shift
            ;;
        --*)
            echo "Unknown option: ${1:-}"
            exit 1
            ;;
        --)
            shift
            break
            ;;
        *)
            break
            ;;
    esac
done

# Consolidate commit message
COMMIT_MESSAGE="$*"

[ -d dist/ ] && rm -r dist/

yarn build
yarn test

# If there's no argument, provide context and exit
if [ -z "$COMMIT_MESSAGE" ]; then
    echo "No arguments provided, you must specify a commit message..."
    sleep 1
    git --no-pager diff HEAD
    git status
    exit 1
fi

if [ "$BUMP_VERSION" = true ]; then
    yarn version $YARN_VERSION_FLAG --no-git-tag-version
fi

if [ "$GIT_PUSH" = true ]; then
    git add -A
    git commit -m "$COMMIT_MESSAGE"
    git push
fi

if [ "$NPM_PUBLISH" = true ]; then
    yarn publish --access public
fi

echo "success"
