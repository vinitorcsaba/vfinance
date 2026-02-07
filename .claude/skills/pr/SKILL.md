---
name: pr
description: Drafts, self-reviews, and creates a GitHub PR using the project's template.
allowed-tools:
  - Bash(git diff *)
  - Bash(git log *)
  - Bash(gh pr create *)
  - Read
argument-hint: "[PR Title]"
---

# Phase 1: Context & Drafting
1. **Analyze**: Run `git diff main...HEAD` and `git log -n 5` to understand the changes.
2. **Template**: Read the PR template from `@.github/PULL_REQUEST_TEMPLATE.md`.
3. **Draft**: Populate the template. Be specific about *why* changes were made, not just *what* was changed.

# Phase 2: Skeptical Review (The "Adversarial" Step)
**Before submitting, perform a self-critique. Check your draft for:**
- **Clarity**: Is the summary understandable to a developer who didn't write this code?
- **Standards**: Does it comply with the guidelines in `@CLAUDE.md` (if it exists)?
- **Completeness**: Did you miss any checkboxes or "Testing" sections in the template?
- **Tone**: Is the title professional and following conventional commits (e.g., `feat:`, `fix:`)?

*If the review finds issues, rewrite the draft. Otherwise, proceed.*

# Phase 3: Execution
1. Create the PR using:
   `! gh pr create --title "$ARGUMENTS" --body-file -`
2. If successful, provide the user with the PR URL.

# Constraints
- If $ARGUMENTS is missing, generate a title using the `type(scope): description` format.
- Do not submit a PR if there are no uncommitted changes or no difference with the main branch.