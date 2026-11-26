# Publish a TryPane release

TryPane distributes a static bundle as a GitHub Release asset. Use the successful push CI run for the release commit on protected `main`. Its `trypane-regex-preview` artifact contains the tested bundle, demo, and Chromium measurements. The release contains the bundle archive.

For 0.1.0, copy the commit SHA and run ID from the successful main CI run. With GitHub CLI authenticated as a release maintainer, run these commands from the repository after replacing the two placeholders.

```sh
(
  set -euo pipefail
  release_commit=REPLACE_WITH_MAIN_CI_COMMIT_SHA
  run_id=REPLACE_WITH_MAIN_CI_RUN_ID
  repo=sunstriker2009/sun-trypane
  tag=v0.1.0
  work_dir=$(mktemp -d)
  git fetch origin main
  git merge-base --is-ancestor "$release_commit" origin/main
  test "$(gh run view "$run_id" -R "$repo" --json conclusion,headSha,headBranch,event --jq '[.conclusion,.headSha,.headBranch,.event] | join(" ")')" = "success $release_commit main push"
  gh run download "$run_id" -R "$repo" -n trypane-regex-preview -D "$work_dir"
  bundle="$work_dir/dist/package/trypane-regex-0.1.0.tar.gz"
  tar -xOzf "$bundle" trypane-regex-0.1.0/manifest.json |
    node -e 'const m = JSON.parse(require("node:fs").readFileSync(0)); if (m.version !== "0.1.0" || m.sourceCommit !== process.argv[1]) process.exit(1)' "$release_commit"
  git tag -a "$tag" "$release_commit" -m "TryPane 0.1.0"
  git push origin "refs/tags/$tag"
  git show "$release_commit:CHANGELOG.md" > "$work_dir/release-notes.md"
  gh release create "$tag" "$bundle" -R "$repo" --verify-tag --title "TryPane 0.1.0" --notes-file "$work_dir/release-notes.md"
)
```

If the tag push succeeded and release creation failed, verify that the remote tag resolves to the same tested commit before retrying release creation. Keep published tags and assets immutable. To roll back an integration, restore its previous bundle or switch back to the host runner. A corrected TryPane bundle gets a new patch version.
