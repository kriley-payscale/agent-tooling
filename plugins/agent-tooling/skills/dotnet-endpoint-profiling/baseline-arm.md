# Before and after arms

## Obtaining the baseline arm

`git stash push -u -- <source paths>` is valid only when the working tree contains nothing but the change under test. Exclude the logging toggle so logging survives. When the tree carries unrelated uncommitted work — a prior stage of the same effort, or temporary instrumentation the measurement depends on — stashing removes that too and the arms stop differing by only the change being measured. Invert just the call site or switch under test, leaving every other modified file identical across both arms, then restore it. Temporary profiling instrumentation must be present in both arms.

`git stash push` / `pop` on source that a watcher is watching (a Tilt live update, `dotnet watch`) triggers a rebuild or publish. Wait for it to settle before measuring. After `git stash pop`, verify the restore with `git status`.

When saving the after-arm working tree for a file-copy A/B, finish the copy and confirm an after-arm token is in the saved file before editing the working tree to the before arm. Do not start the invert in the same parallel batch as the copy — the copy can race and snapshot the inverted file, so "restore after" silently keeps the before arm.

## Provisional baselines

A baseline captured before implementation is provisional, even when it was taken in the same session (as `implement-plan` requires before dispatch). Machine load can shift between that baseline and the after arm.

When the after arm separates from the baseline but the changed statement's plan-cache cost (logical reads and CPU) moved far less than the wall-time gap, do not apply acceptance thresholds or switch query shapes yet. Run a same-window A/B/A first:

1. Save the changed file.
2. Restore only that file to `HEAD`, wait for the publish and restart, and time it.
3. Restore the saved file and prove the restore with `cmp` against the saved copy (on Windows the form is `fc.exe /b <a> <b>`, because plain `fc` is `Format-Custom`). Record the published-assembly hash as supporting evidence; `cmp` is the proof.
4. Time again.

Judge the change only on the A/B/A arms, and report the earlier baseline's drift as environmental.
