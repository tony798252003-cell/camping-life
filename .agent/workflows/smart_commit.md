---
description: Automatically stage, commit, and push changes to GitHub. This effectively "Syncs" your work to the cloud, allowing you to back up your progress or continue working from another device (e.g., home). Note: Pushing to the main branch may trigger a deployment on Vercel, which is normal and keeps your live site up to date.
---

1.  **Understand Intent**:
    *   Determine if the user wants to **Sync/Save** (WIP) or **Deploy** (Release).

2.  **Safety Check (Branching)**:
    *   Run `git branch --show-current`.
    *   **If Syncing/Saving**:
        *   If on `main`, create/switch to a `dev` branch: `git checkout -b dev` (or `git checkout dev`).
    *   **If Deploying**:
        *   If on `dev`, merge to `main`:
            1.  `git checkout main`
            2.  `git merge dev`
            3.  `git push origin main`
            4.  `git checkout dev` (return to dev for work).

3.  **Stage & Commit**:
    *   `git add .`
    *   `git commit -m "..."` (Use "wip: ..." for incomplete work, "feat/fix: ..." for releases).

4.  **Push**:
    *   `git push` (or `git push -u origin dev` if new).
    *   *Note*: Pushing to `dev` creates a Preview URL on Vercel (Production remains safe). Pushing to `main` updates Production.

5.  **Notify**:
    *   Tell the user which branch was updated and whether it was a Safe Sync or Production Deploy.
